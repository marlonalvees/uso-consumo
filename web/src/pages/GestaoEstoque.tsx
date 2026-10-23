import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { AbcClass, Item, MovementsPage, StockMovement, StockMovementType, StockSuggestion } from '../types'
import { useToast } from '../context/ToastContext'
import { normalizeText } from '../lib/text'
import { isLowStock } from '../lib/stock'
import { formatDateTime, plural, timeAgo } from '../lib/format'
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass, selectClass } from '../lib/ui'
import Tabs from '../components/ui/Tabs'
import Sheet from '../components/ui/Sheet'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import ItemSearchSelect from '../components/ItemSearchSelect'
import { ArchiveIcon, ClipboardCheckIcon, CloseIcon, EyeIcon, EyeOffIcon, HistoryIcon, PlusIcon, SearchIcon, WarehouseIcon } from '../components/icons'

type Tab = 'estoque' | 'inventario' | 'ajuste' | 'movimentacoes'
type StockFilter = 'todos' | 'minimo' | 'zerados'

const ABC_STYLES: Record<AbcClass, string> = {
  A: 'bg-red-50 text-red-700',
  B: 'bg-amber-50 text-amber-800',
  C: 'bg-gray-100 text-gray-600',
}

function movementOrigin(movement: StockMovement) {
  if (movement.purchase) return `Compra · ${movement.purchase.supplier.name}`
  if (movement.order) return `Pedido · ${movement.order.branch.name}`
  return movement.reason
}

function signedQuantity(movement: StockMovement) {
  return movement.type === 'ENTRADA' ? movement.quantity : -movement.quantity
}

function MovementRow({ movement, showItem = true }: { movement: StockMovement; showItem?: boolean }) {
  const delta = signedQuantity(movement)
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={`flex h-9 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold tabular-nums ${
          delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}
      >
        {delta > 0 ? `+${delta}` : delta}
      </span>
      <div className="min-w-0 flex-1">
        {showItem && <p className="truncate text-sm font-bold text-gray-900">{movement.item.name}</p>}
        <p className="truncate text-xs text-gray-600">{movementOrigin(movement)}</p>
        <p className="text-[11px] text-gray-500">
          {formatDateTime(movement.createdAt)}
          {movement.createdBy && ` · ${movement.createdBy.name}`}
        </p>
      </div>
      {movement.balanceAfter !== null && (
        <span className="shrink-0 text-right">
          <span className="block text-[10px] font-semibold text-gray-500">saldo</span>
          <span className={`text-sm font-extrabold tabular-nums ${movement.balanceAfter < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {movement.balanceAfter}
          </span>
        </span>
      )}
    </li>
  )
}

/** Lista paginada de movimentações (todas, ou a ficha de um produto). */
function useMovements(filters: { itemId?: string; type?: string; from?: string; to?: string }, enabled: boolean) {
  const [movements, setMovements] = useState<StockMovement[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const query = useMemo(() => {
    const params = new URLSearchParams({ take: '30' })
    if (filters.itemId) params.set('itemId', filters.itemId)
    if (filters.type) params.set('type', filters.type)
    if (filters.from) params.set('from', new Date(`${filters.from}T00:00:00`).toISOString())
    if (filters.to) params.set('to', new Date(`${filters.to}T23:59:59`).toISOString())
    return params.toString()
  }, [filters.itemId, filters.type, filters.from, filters.to])

  const load = useCallback(() => {
    setMovements(null)
    api
      .get<MovementsPage>(`/stock/movements?${query}`)
      .then((page) => {
        setMovements(page.movements)
        setCursor(page.nextCursor)
      })
      .catch(() => setMovements([]))
  }, [query])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const page = await api.get<MovementsPage>(`/stock/movements?${query}&cursor=${cursor}`)
      setMovements((prev) => [...(prev ?? []), ...page.movements])
      setCursor(page.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }

  return { movements, hasMore: cursor !== null, loadMore, loadingMore, reload: load }
}

function KardexSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { movements, hasMore, loadMore, loadingMore } = useMovements({ itemId: item?.id }, item !== null)
  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      variant="drawer"
      title={item ? `Ficha · ${item.name}` : ''}
      subtitle={item ? `Saldo atual: ${item.stockQuantity} ${item.packaging.name}` : undefined}
    >
      {movements === null ? (
        <SkeletonCards count={4} className="h-14" />
      ) : movements.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Nenhuma movimentação" compact />
      ) : (
        <>
          <ul className="-mx-5 divide-y divide-gray-100">
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} showItem={false} />
            ))}
          </ul>
          {hasMore && (
            <button type="button" onClick={loadMore} disabled={loadingMore} className={`${btnSecondary} mt-3 w-full`}>
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}

export default function GestaoEstoque() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('estoque')
  const [items, setItems] = useState<Item[] | null>(null)
  const [suggestions, setSuggestions] = useState<Map<string, StockSuggestion>>(new Map())
  const [kardexItem, setKardexItem] = useState<Item | null>(null)

  // estoque atual
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('todos')

  // inventário
  const [countScope, setCountScope] = useState<'todos' | 'A' | 'antigos'>('todos')
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [blind, setBlind] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [justification, setJustification] = useState('')
  const [savingCount, setSavingCount] = useState(false)

  // ajuste avulso
  const [adjustRows, setAdjustRows] = useState([{ id: crypto.randomUUID(), itemId: '', type: 'SAIDA' as StockMovementType, quantity: '1' }])
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // movimentações
  const [movementType, setMovementType] = useState('')
  const [movementItem, setMovementItem] = useState('')
  const [movementFrom, setMovementFrom] = useState('')
  const [movementTo, setMovementTo] = useState('')
  const movementsList = useMovements(
    { itemId: movementItem || undefined, type: movementType || undefined, from: movementFrom || undefined, to: movementTo || undefined },
    tab === 'movimentacoes',
  )

  const loadItems = useCallback(() => {
    Promise.all([api.get<Item[]>('/items'), api.get<StockSuggestion[]>('/items/stock-suggestions')])
      .then(([itemsData, suggestionsData]) => {
        setItems(itemsData)
        setSuggestions(new Map(suggestionsData.map((s) => [s.itemId, s])))
      })
      .catch(() => {
        setItems([])
        toast.error('Não foi possível carregar o estoque')
      })
  }, [toast])

  useEffect(loadItems, [loadItems])

  const activeItems = useMemo(() => (items ?? []).filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name)), [items])
  const belowMin = activeItems.filter((item) => isLowStock(item)).length
  const negative = activeItems.filter((item) => item.stockQuantity < 0).length

  const term = normalizeText(search)
  const stockRows = activeItems.filter((item) => {
    if (term && !normalizeText(item.name).includes(term)) return false
    if (stockFilter === 'minimo') return isLowStock(item)
    if (stockFilter === 'zerados') return item.stockQuantity <= 0
    return true
  })

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const countItems = activeItems.filter((item) => {
    if (countScope === 'A') return suggestions.get(item.id)?.abcClass === 'A'
    if (countScope === 'antigos') return !item.lastCountedAt || new Date(item.lastCountedAt).getTime() < thirtyDaysAgo
    return true
  })
  const countedEntries = countItems
    .filter((item) => counts[item.id] !== undefined && counts[item.id] !== '')
    .map((item) => ({ item, counted: Math.max(0, Math.floor(Number(counts[item.id]) || 0)) }))
  const differences = countedEntries.filter(({ item, counted }) => counted !== item.stockQuantity)
  // diferença grande = 3 unidades ou 10% do saldo: pede justificativa
  const bigDifferences = differences.filter(({ item, counted }) => Math.abs(counted - item.stockQuantity) >= Math.max(3, Math.abs(item.stockQuantity) * 0.1))

  async function submitCount() {
    if (bigDifferences.length > 0 && !justification.trim()) {
      toast.error('Explique as diferenças grandes antes de lançar')
      return
    }
    setSavingCount(true)
    try {
      await api.post('/stock/counts', {
        entries: countedEntries.map(({ item, counted }) => ({ itemId: item.id, countedQuantity: counted })),
        reason: justification.trim() || undefined,
      })
      toast.success(`Inventário lançado: ${plural(countedEntries.length, 'produto contado', 'produtos contados')}, ${plural(differences.length, 'ajuste', 'ajustes')}`)
      setCounts({})
      setJustification('')
      setReviewing(false)
      loadItems()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível lançar o inventário')
    } finally {
      setSavingCount(false)
    }
  }

  async function submitAdjust() {
    const valid = adjustRows.filter((row) => row.itemId && Number(row.quantity) > 0)
    if (valid.length === 0) {
      toast.error('Escolha o produto e a quantidade')
      return
    }
    setAdjusting(true)
    try {
      await api.post('/stock/adjustments/batch', {
        entries: valid.map((row) => ({ itemId: row.itemId, type: row.type, quantity: Math.floor(Number(row.quantity)) })),
        reason: adjustReason.trim() || undefined,
      })
      toast.success('Ajuste registrado')
      setAdjustRows([{ id: crypto.randomUUID(), itemId: '', type: 'SAIDA', quantity: '1' }])
      setAdjustReason('')
      loadItems()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar o ajuste')
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900">Estoque</h1>
      <p className="mb-4 text-sm text-gray-500">Entra com compras recebidas, sai quando o pedido é enviado. Inventário corrige a diferença.</p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className={`${cardClass} p-3.5`}>
          <p className="text-xs font-bold text-gray-500">Produtos ativos</p>
          <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{activeItems.length}</p>
        </div>
        <button type="button" onClick={() => { setTab('estoque'); setStockFilter('minimo') }} className={`press ${cardClass} p-3.5 text-left`}>
          <p className="text-xs font-bold text-gray-500">No mínimo ou abaixo</p>
          <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{belowMin}</p>
        </button>
        <button type="button" onClick={() => { setTab('estoque'); setStockFilter('zerados') }} className={`press ${cardClass} p-3.5 text-left`}>
          <p className="text-xs font-bold text-gray-500">Saldo negativo</p>
          <p className="text-2xl font-extrabold text-red-600 tabular-nums">{negative}</p>
        </button>
      </div>

      <Tabs
        variant="underline"
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'estoque', label: 'Estoque atual', icon: WarehouseIcon },
          { value: 'inventario', label: 'Inventário', icon: ClipboardCheckIcon },
          { value: 'ajuste', label: 'Ajuste avulso', icon: ArchiveIcon },
          { value: 'movimentacoes', label: 'Movimentações', icon: HistoryIcon },
        ]}
      />

      {items === null ? (
        <SkeletonCards count={5} className="h-14" />
      ) : tab === 'estoque' ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-52 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" className={`${inputClass} pl-10`} />
            </div>
            <Tabs
              value={stockFilter}
              onChange={setStockFilter}
              tabs={[
                { value: 'todos', label: 'Todos' },
                { value: 'minimo', label: 'No mínimo', count: belowMin },
                { value: 'zerados', label: 'Zerados', count: activeItems.filter((i) => i.stockQuantity <= 0).length },
              ]}
            />
          </div>
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full min-w-160 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500">
                <tr>
                  <th className="px-4 py-2.5">Produto</th>
                  <th className="px-2 py-2.5 text-center" title="Curva ABC pelo valor consumido">ABC</th>
                  <th className="px-2 py-2.5 text-right">Saldo</th>
                  <th className="px-2 py-2.5 text-right">Mín. / ideal</th>
                  <th className="px-2 py-2.5">Última contagem</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockRows.map((item) => {
                  const suggestion = suggestions.get(item.id)
                  const low = isLowStock(item)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.category.name} · {item.packaging.name}</p>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {suggestion && <span className={`rounded-md px-1.5 py-0.5 text-xs font-extrabold ${ABC_STYLES[suggestion.abcClass]}`}>{suggestion.abcClass}</span>}
                      </td>
                      <td className={`px-2 py-2.5 text-right font-extrabold tabular-nums ${item.stockQuantity < 0 ? 'text-red-600' : low ? 'text-amber-600' : 'text-gray-900'}`}>
                        {item.stockQuantity}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-600 tabular-nums">
                        {item.minStock} / {item.targetStock ?? item.minStock * 2}
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-600">{item.lastCountedAt ? timeAgo(item.lastCountedAt) : 'Nunca'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" onClick={() => setKardexItem(item)} className="press rounded-lg px-2.5 py-1.5 text-xs font-bold text-orange-base hover:bg-orange-base/10">
                          Ficha
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {stockRows.length === 0 && <EmptyState icon={WarehouseIcon} title="Nenhum produto nesse filtro" compact />}
          </div>
        </>
      ) : tab === 'inventario' ? (
        <div className="space-y-4">
          <div className={`${cardClass} flex flex-wrap items-center gap-3 p-4`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">Conte e digite o que tem na prateleira</p>
              <p className="text-xs text-gray-500">O sistema calcula a diferença e lança o ajuste. Conte a curva A toda semana e o resto todo mês.</p>
            </div>
            <select value={countScope} onChange={(e) => setCountScope(e.target.value as typeof countScope)} aria-label="O que contar" className={selectClass}>
              <option value="todos">Todos os produtos</option>
              <option value="A">Só curva A (mais importantes)</option>
              <option value="antigos">Sem contagem há 30 dias</option>
            </select>
            <button type="button" onClick={() => setBlind((v) => !v)} className={btnSecondary} aria-pressed={blind}>
              {blind ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              {blind ? 'Contagem cega' : 'Mostrando saldo'}
            </button>
          </div>

          <ul className={`${cardClass} divide-y divide-gray-100`}>
            {countItems.map((item) => {
              const value = counts[item.id] ?? ''
              const counted = value === '' ? null : Math.max(0, Math.floor(Number(value) || 0))
              const diff = counted === null ? null : counted - item.stockQuantity
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.packaging.name}
                      {!blind && ` · sistema: ${item.stockQuantity}`}
                    </p>
                  </div>
                  {!blind && diff !== null && diff !== 0 && (
                    <span className={`text-xs font-extrabold tabular-nums ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff > 0 ? `+${diff}` : diff}</span>
                  )}
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="—"
                    aria-label={`Quantidade contada de ${item.name}`}
                    className="w-20 rounded-xl border border-gray-200 px-2 py-2 text-center text-sm font-bold focus:border-orange-base focus:ring-2 focus:ring-orange-base/20 focus:outline-none"
                  />
                </li>
              )
            })}
          </ul>

          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 lg:bottom-4">
            <button type="button" disabled={countedEntries.length === 0} onClick={() => setReviewing(true)} className={`${btnPrimary} w-full py-3 shadow-float`}>
              Revisar contagem · {plural(countedEntries.length, 'produto', 'produtos')}
            </button>
          </div>

          <Sheet
            open={reviewing}
            onClose={() => setReviewing(false)}
            dismissible={false}
            title="Revisar inventário"
            subtitle={`${plural(countedEntries.length, 'produto contado', 'produtos contados')}, ${plural(differences.length, 'com diferença', 'com diferença')}`}
            footer={
              <div className="flex gap-2">
                <button type="button" onClick={() => setReviewing(false)} className={`${btnSecondary} flex-1`}>
                  Voltar
                </button>
                <button type="button" onClick={submitCount} disabled={savingCount} className={`${btnPrimary} flex-2`}>
                  {savingCount ? 'Lançando...' : 'Lançar inventário'}
                </button>
              </div>
            }
          >
            {differences.length === 0 ? (
              <EmptyState icon={ClipboardCheckIcon} title="Tudo bateu com o sistema" description="A data da contagem fica registrada." compact />
            ) : (
              <ul className="divide-y divide-gray-100">
                {differences.map(({ item, counted }) => {
                  const diff = counted - item.stockQuantity
                  const big = bigDifferences.some((d) => d.item.id === item.id)
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          Sistema {item.stockQuantity} → contado {counted}
                        </p>
                      </div>
                      {big && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">Grande</span>}
                      <span className={`text-sm font-extrabold tabular-nums ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff > 0 ? `+${diff}` : diff}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            <label htmlFor="count-justification" className={`${labelClass} mt-4`}>
              {bigDifferences.length > 0 ? 'Por que as diferenças grandes? (obrigatório)' : 'Observação (opcional)'}
            </label>
            <textarea
              id="count-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={2}
              placeholder="Ex.: caixa de detergente avariada encontrada no fundo do estoque"
              className={inputClass}
            />
          </Sheet>
        </div>
      ) : tab === 'ajuste' ? (
        <div className={`${cardClass} space-y-3 p-4`}>
          <p className="text-sm text-gray-600">Para perdas, avarias, doações ou entradas sem compra. Para corrigir o saldo de vez, use o inventário.</p>
          {adjustRows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 p-2.5">
              <div className="min-w-52 flex-1">
                <ItemSearchSelect
                  items={activeItems}
                  value={row.itemId}
                  onChange={(itemId) => setAdjustRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, itemId } : r)))}
                />
              </div>
              <div className="flex rounded-full bg-white p-0.5 text-xs font-bold ring-1 ring-gray-200">
                {(['SAIDA', 'ENTRADA'] as StockMovementType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAdjustRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, type } : r)))}
                    className={`press rounded-full px-3 py-1.5 ${row.type === type ? (type === 'SAIDA' ? 'bg-red-base text-white' : 'bg-emerald-500 text-white') : 'text-gray-600'}`}
                  >
                    {type === 'SAIDA' ? 'Saída' : 'Entrada'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={row.quantity}
                onChange={(e) => setAdjustRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quantity: e.target.value } : r)))}
                aria-label="Quantidade"
                className="w-20 rounded-xl border border-gray-200 px-2 py-2 text-center text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => setAdjustRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev))}
                aria-label="Remover linha"
                className="rounded-full p-2 text-gray-400 hover:bg-gray-200"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAdjustRows((prev) => [...prev, { id: crypto.randomUUID(), itemId: '', type: 'SAIDA', quantity: '1' }])}
            className="press inline-flex items-center gap-1.5 text-sm font-bold text-orange-base"
          >
            <PlusIcon className="h-4 w-4" /> Outro produto
          </button>
          <div>
            <label htmlFor="adjust-reason" className={labelClass}>
              Motivo
            </label>
            <input id="adjust-reason" type="text" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Ex.: avaria no transporte" className={inputClass} />
          </div>
          <button type="button" onClick={submitAdjust} disabled={adjusting} className={`${btnPrimary} w-full`}>
            {adjusting ? 'Registrando...' : 'Registrar ajuste'}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="min-w-52 flex-1">
              <ItemSearchSelect items={activeItems} value={movementItem} onChange={setMovementItem} placeholder="Filtrar por produto" />
            </div>
            <select value={movementType} onChange={(e) => setMovementType(e.target.value)} aria-label="Tipo" className={selectClass}>
              <option value="">Entradas e saídas</option>
              <option value="ENTRADA">Só entradas</option>
              <option value="SAIDA">Só saídas</option>
            </select>
            <input type="date" value={movementFrom} onChange={(e) => setMovementFrom(e.target.value)} aria-label="De" className={selectClass} />
            <input type="date" value={movementTo} onChange={(e) => setMovementTo(e.target.value)} aria-label="Até" className={selectClass} />
          </div>
          {movementsList.movements === null ? (
            <SkeletonCards count={5} className="h-14" />
          ) : movementsList.movements.length === 0 ? (
            <div className={cardClass}>
              <EmptyState icon={HistoryIcon} title="Nenhuma movimentação" compact />
            </div>
          ) : (
            <>
              <ul className={`${cardClass} divide-y divide-gray-100`}>
                {movementsList.movements.map((movement) => (
                  <MovementRow key={movement.id} movement={movement} />
                ))}
              </ul>
              {movementsList.hasMore && (
                <button type="button" onClick={movementsList.loadMore} disabled={movementsList.loadingMore} className={`${btnSecondary} mt-3 w-full`}>
                  {movementsList.loadingMore ? 'Carregando...' : 'Carregar mais'}
                </button>
              )}
            </>
          )}
        </>
      )}

      <KardexSheet item={kardexItem} onClose={() => setKardexItem(null)} />
    </div>
  )
}
