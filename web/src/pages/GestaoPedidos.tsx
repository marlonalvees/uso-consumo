import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Order, OrderStatus } from '../types'
import { useOrders } from '../context/OrdersContext'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'
import { useNow } from '../hooks/useNow'
import { useNavigationFocus } from '../hooks/useNavigationFocus'
import { usePrintJob } from '../hooks/usePrintJob'
import { DATE_PRESET_OPTIONS, matchesDatePreset, type DatePreset } from '../lib/dateFilter'
import { normalizeText } from '../lib/text'
import { formatDate, formatDateTime, orderCode, plural, timeAgo } from '../lib/format'
import { STATUS_DOTS, STATUS_LABELS } from '../lib/orderStatus'
import { btnPrimary, btnSecondary, btnTeal, cardClass, inputClass, selectClass } from '../lib/ui'
import { AgeChip, StatusPill } from '../components/ui/StatusPill'
import Tabs from '../components/ui/Tabs'
import Menu from '../components/ui/Menu'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import OrderFulfillmentModal from '../components/OrderFulfillmentModal'
import OrderPrintSheet from '../components/OrderPrintSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import OrderDetailSheet from '../components/orders/OrderDetailSheet'
import CancelOrderSheet from '../components/orders/CancelOrderSheet'
import PickListPrint from '../components/orders/PickListPrint'
import { readSoundEnabled, writeSoundEnabled } from '../lib/sound'
import {
  AlertIcon,
  BanIcon,
  BoardIcon,
  CheckCircleIcon,
  CloseIcon,
  EditIcon,
  EyeIcon,
  ListChecksIcon,
  ListIcon,
  NoteIcon,
  PrinterIcon,
  RefreshIcon,
  SearchIcon,
  SoundOffIcon,
  SoundOnIcon,
} from '../components/icons'

type BoardStatus = Extract<OrderStatus, 'RECEBIDO' | 'EM_ANDAMENTO' | 'ENVIADO'>

const COLUMNS: { status: BoardStatus; title: string; empty: string }[] = [
  { status: 'RECEBIDO', title: 'Recebidos', empty: 'Nenhum pedido novo. Tudo em dia!' },
  { status: 'EM_ANDAMENTO', title: 'Em separação', empty: 'Nada sendo separado agora.' },
  { status: 'ENVIADO', title: 'Enviados', empty: 'Nenhum pedido aguardando a filial confirmar.' },
]

const COLUMN_BAR: Record<BoardStatus, string> = {
  RECEBIDO: 'bg-red-base',
  EM_ANDAMENTO: 'bg-amber-400',
  ENVIADO: 'bg-blue-600',
}

const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  RECEBIDO: { status: 'EM_ANDAMENTO', label: 'Iniciar separação' },
  EM_ANDAMENTO: { status: 'ENVIADO', label: 'Marcar como enviado' },
}

type PrintJob = { kind: 'orders'; orders: Order[] } | { kind: 'picklist'; orders: Order[] }

type HistoryFilter = 'todos' | 'ENTREGUE' | 'CANCELADO' | 'divergencia'

function matchesSearch(order: Order, term: string) {
  if (!term) return true
  return (
    normalizeText(order.branch.name).includes(term) ||
    normalizeText(order.requestedBy.name).includes(term) ||
    orderCode(order).toLowerCase().includes(term) ||
    order.items.some((oi) => normalizeText(oi.item.name).includes(term)) ||
    order.extraItems.some((e) => normalizeText(e.name).includes(term))
  )
}

function hasDivergence(order: Order) {
  return [...order.items, ...order.extraItems].some((line) => line.receiptIssue)
}

interface BoardCardProps {
  order: Order
  now: number
  highlighted: boolean
  selected: boolean
  updating: boolean
  lowStockCount: number
  onToggleSelect: () => void
  onOpen: () => void
  onAdvance: () => void
  onEdit: () => void
  onCancel: () => void
  onPrint: () => void
}

function BoardCard({
  order,
  now,
  highlighted,
  selected,
  updating,
  lowStockCount,
  onToggleSelect,
  onOpen,
  onAdvance,
  onEdit,
  onCancel,
  onPrint,
}: BoardCardProps) {
  const lines = [
    ...order.items.filter((oi) => oi.quantity > 0).map((oi) => ({ key: oi.id, label: oi.item.name, quantity: oi.quantity })),
    ...order.extraItems.filter((e) => e.quantity > 0).map((e) => ({ key: e.id, label: `${e.name} (extra)`, quantity: e.quantity })),
  ]
  const next = NEXT_STEP[order.status]
  const isNew = order.status === 'RECEBIDO' && now - new Date(order.createdAt).getTime() < 10 * 60_000
  const selectable = order.status === 'RECEBIDO' || order.status === 'EM_ANDAMENTO'

  return (
    <article
      onClick={onOpen}
      className={`group cursor-pointer rounded-2xl bg-white p-3.5 shadow-card ring-1 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-float ${
        highlighted ? 'ring-2 ring-orange-base' : selected ? 'ring-2 ring-gray-900' : 'ring-transparent'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleSelect}
            aria-label={`Selecionar pedido da filial ${order.branch.name}`}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-gray-900"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-extrabold text-gray-900">{order.branch.name}</p>
            <AgeChip status={order.status} since={order.statusChangedAt} now={now} />
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {orderCode(order)} · {order.requestedBy.name} · {formatDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      {isNew && (
        <span className="mt-2 inline-flex animate-pulse items-center gap-1 rounded-full bg-red-base px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white uppercase">
          Novo
        </span>
      )}

      {order.notes && (
        <p className="mt-2 flex gap-1.5 rounded-lg bg-orange-base/10 px-2 py-1.5 text-xs text-gray-800">
          <NoteIcon className="mt-px h-3.5 w-3.5 shrink-0 text-orange-base" />
          <span className="line-clamp-2">{order.notes}</span>
        </p>
      )}

      <ul className="mt-2.5 space-y-1">
        {lines.slice(0, 3).map((line) => (
          <li key={line.key} className="flex items-baseline gap-2 text-sm">
            <span className="w-7 shrink-0 text-right font-extrabold text-orange-base tabular-nums">{line.quantity}×</span>
            <span className="truncate text-gray-700">{line.label}</span>
          </li>
        ))}
        {lines.length > 3 && <li className="pl-9 text-xs font-bold text-gray-500">+ {plural(lines.length - 3, 'item', 'itens')}</li>}
      </ul>

      {lowStockCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-600">
          <AlertIcon className="h-3.5 w-3.5" /> {plural(lowStockCount, 'item', 'itens')} sem saldo suficiente
        </p>
      )}

      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {next ? (
          <button
            type="button"
            onClick={onAdvance}
            disabled={updating}
            className={`${order.status === 'EM_ANDAMENTO' ? btnTeal : btnPrimary} flex-1 py-2`}
          >
            {updating ? 'Aguarde...' : next.label}
          </button>
        ) : (
          <button type="button" onClick={onOpen} className={`${btnSecondary} flex-1 py-2`}>
            <EyeIcon className="h-4 w-4" /> Ver detalhes
          </button>
        )}
        <Menu
          actions={[
            { label: 'Ver detalhes', icon: EyeIcon, onClick: onOpen },
            { label: 'Ajustar itens', icon: EditIcon, onClick: onEdit },
            { label: 'Imprimir guia', icon: PrinterIcon, onClick: onPrint },
            { label: 'Cancelar pedido', icon: BanIcon, onClick: onCancel, danger: true, disabled: !selectable },
          ]}
        />
      </div>
    </article>
  )
}

export default function GestaoPedidos() {
  const { orders, loadingOrders, refreshOrders, updateOrder } = useOrders()
  const { items: catalog } = useItems()
  const toast = useToast()
  const now = useNow(30_000)
  const focusStatus = useNavigationFocus<OrderStatus>('focusStatus')
  const { job: printJob, print } = usePrintJob<PrintJob>()

  const [view, setView] = useState<'quadro' | 'historico'>('quadro')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<number | ''>('')
  const [mobileStage, setMobileStage] = useState<BoardStatus>('RECEBIDO')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Order | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [confirmShip, setConfirmShip] = useState<Order | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(readSoundEnabled)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('todos')
  const [datePreset, setDatePreset] = useState<DatePreset>('mes')
  const [historyLimit, setHistoryLimit] = useState(30)

  useEffect(() => {
    refreshOrders()
  }, [refreshOrders])

  // vindo da barra do topo: abre a etapa clicada (no celular) e rola até ela
  useEffect(() => {
    if (!focusStatus || loadingOrders) return
    if (focusStatus === 'RECEBIDO' || focusStatus === 'EM_ANDAMENTO' || focusStatus === 'ENVIADO') {
      setView('quadro')
      setMobileStage(focusStatus)
      requestAnimationFrame(() =>
        document.getElementById(`coluna-${focusStatus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    }
  }, [focusStatus, loadingOrders])

  const stockById = useMemo(() => new Map(catalog.map((item) => [item.id, item.stockQuantity])), [catalog])
  const term = normalizeText(search)
  const branchOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const order of orders) map.set(order.branch.id, order.branch.name)
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [orders])

  const boardOrders = orders.filter(
    (o) => (o.status === 'RECEBIDO' || o.status === 'EM_ANDAMENTO' || o.status === 'ENVIADO') && (!branchFilter || o.branchId === branchFilter) && matchesSearch(o, term),
  )
  const columns = COLUMNS.map((col) => ({
    ...col,
    // o mais antigo primeiro: é o que precisa de atenção
    orders: boardOrders.filter((o) => o.status === col.status).sort((a, b) => a.statusChangedAt.localeCompare(b.statusChangedAt)),
  }))

  const historyOrders = orders.filter((o) => {
    if (o.status !== 'ENTREGUE' && o.status !== 'CANCELADO') return false
    if (historyFilter === 'divergencia' ? !hasDivergence(o) : historyFilter !== 'todos' && o.status !== historyFilter) return false
    if (branchFilter && o.branchId !== branchFilter) return false
    if (!matchesDatePreset(o.createdAt, datePreset, '', '')) return false
    return matchesSearch(o, term)
  })

  const detail = detailId ? (orders.find((o) => o.id === detailId) ?? null) : null
  const selectedOrders = orders.filter((o) => selected.has(o.id))

  function lowStockCount(order: Order) {
    if (order.status !== 'RECEBIDO' && order.status !== 'EM_ANDAMENTO') return 0
    return order.items.filter((oi) => oi.quantity > 0 && oi.quantity > (stockById.get(oi.itemId) ?? oi.item.stockQuantity)).length
  }

  async function moveTo(order: Order, status: OrderStatus) {
    setUpdatingId(order.id)
    try {
      const updated = await api.patch<Order>(`/orders/${order.id}/status`, { status })
      updateOrder(updated)
      if (status === 'EM_ANDAMENTO') {
        toast.success(`Separação iniciada · ${order.branch.name}`, {
          action: { label: 'Desfazer', onClick: () => moveTo(updated, 'RECEBIDO') },
        })
      } else if (status === 'ENVIADO') {
        toast.success(`Pedido da filial ${order.branch.name} enviado`)
      } else if (status === 'RECEBIDO') {
        toast.info('Separação desfeita')
      }
      return updated
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar o pedido')
      return null
    } finally {
      setUpdatingId(null)
    }
  }

  function advance(order: Order) {
    const next = NEXT_STEP[order.status]
    if (!next) return
    // o envio baixa o estoque: pede confirmação
    if (next.status === 'ENVIADO') setConfirmShip(order)
    else moveTo(order, next.status)
  }

  async function startSeparationBatch() {
    const targets = selectedOrders.filter((o) => o.status === 'RECEBIDO')
    for (const order of targets) await moveTo(order, 'EM_ANDAMENTO')
    setSelected(new Set())
    if (targets.length > 1) toast.success(`${targets.length} pedidos em separação`)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSound() {
    setSoundOn((on) => {
      writeSoundEnabled(!on)
      return !on
    })
  }

  const counts = Object.fromEntries(columns.map((col) => [col.status, col.orders.length])) as Record<BoardStatus, number>

  return (
    <div>
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Gestão de pedidos</h1>
            <p className="text-sm text-gray-500">Do mais antigo para o mais novo em cada etapa. Toque no cartão para ver tudo.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              title={soundOn ? 'Som de pedido novo ligado' : 'Som de pedido novo desligado'}
              className={`press flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-colors ${
                soundOn ? 'bg-orange-base text-white ring-orange-base' : 'bg-white text-gray-500 ring-gray-200'
              }`}
            >
              {soundOn ? <SoundOnIcon className="h-5 w-5" /> : <SoundOffIcon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => refreshOrders().then(() => toast.info('Pedidos atualizados'))}
              aria-label="Atualizar pedidos"
              className="press flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-600 ring-1 ring-gray-200"
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Tabs
          variant="underline"
          className="mb-4"
          value={view}
          onChange={setView}
          tabs={[
            { value: 'quadro', label: 'Quadro', icon: BoardIcon, count: counts.RECEBIDO },
            { value: 'historico', label: 'Histórico', icon: ListIcon },
          ]}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar filial, pessoa, item ou código"
              aria-label="Buscar pedidos"
              className={`${inputClass} pl-10`}
            />
          </div>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : '')} aria-label="Filial" className={selectClass}>
            <option value="">Todas as filiais</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {view === 'historico' && (
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)} aria-label="Período" className={selectClass}>
              {DATE_PRESET_OPTIONS.filter((o) => o.value !== 'periodo').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === 'todos' ? 'Qualquer data' : option.label}
                </option>
              ))}
            </select>
          )}
          {(search || branchFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setBranchFilter('')
              }}
              className="press inline-flex items-center gap-1 rounded-xl px-3 text-sm font-bold text-orange-base"
            >
              <CloseIcon className="h-4 w-4" /> Limpar
            </button>
          )}
        </div>

        {loadingOrders ? (
          <SkeletonCards count={3} className="h-40" />
        ) : view === 'quadro' ? (
          <>
            <Tabs
              className="mb-3 lg:hidden"
              value={mobileStage}
              onChange={setMobileStage}
              tabs={COLUMNS.map((col) => ({ value: col.status, label: col.title, count: counts[col.status], dot: STATUS_DOTS[col.status] }))}
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {columns.map((col) => {
                const oldest = col.orders[0]
                return (
                  <section
                    key={col.status}
                    id={`coluna-${col.status}`}
                    className={`scroll-mt-20 flex-col lg:flex lg:scroll-mt-6 ${mobileStage === col.status ? 'flex' : 'hidden'}`}
                  >
                    <div className="mb-3 overflow-hidden rounded-2xl bg-white shadow-card">
                      <div className={`h-1.5 ${COLUMN_BAR[col.status]}`} />
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                        <div>
                          <h2 className="text-sm font-extrabold text-gray-900">{col.title}</h2>
                          <p className="text-xs text-gray-500">{oldest ? `Mais antigo ${timeAgo(oldest.statusChangedAt, now)}` : 'Vazio'}</p>
                        </div>
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-100 px-2 text-sm font-extrabold text-gray-800">
                          {col.orders.length}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      {col.orders.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-gray-200 px-4 py-8 text-center">
                          <CheckCircleIcon className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                          <p className="text-sm font-semibold text-gray-500">{col.empty}</p>
                        </div>
                      ) : (
                        col.orders.map((order) => (
                          <BoardCard
                            key={order.id}
                            order={order}
                            now={now}
                            highlighted={focusStatus === col.status}
                            selected={selected.has(order.id)}
                            updating={updatingId === order.id}
                            lowStockCount={lowStockCount(order)}
                            onToggleSelect={() => toggleSelect(order.id)}
                            onOpen={() => setDetailId(order.id)}
                            onAdvance={() => advance(order)}
                            onEdit={() => setEditing(order)}
                            onCancel={() => setCancelTarget(order)}
                            onPrint={() => print({ kind: 'orders', orders: [order] })}
                          />
                        ))
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <Tabs
              className="mb-3"
              value={historyFilter}
              onChange={setHistoryFilter}
              tabs={[
                { value: 'todos', label: 'Todos' },
                { value: 'ENTREGUE', label: 'Entregues' },
                { value: 'CANCELADO', label: 'Cancelados' },
                { value: 'divergencia', label: 'Com divergência' },
              ]}
            />
            {historyOrders.length === 0 ? (
              <div className={cardClass}>
                <EmptyState icon={ListIcon} title="Nenhum pedido no período" description="Mude o período ou os filtros." />
              </div>
            ) : (
              <ul className={`${cardClass} divide-y divide-gray-100 overflow-hidden`}>
                {historyOrders.slice(0, historyLimit).map((order) => (
                  <li key={order.id}>
                    <button type="button" onClick={() => setDetailId(order.id)} className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">
                          {order.branch.name} <span className="font-normal text-gray-500">· {orderCode(order)}</span>
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {formatDate(order.createdAt)} · {order.requestedBy.name} ·{' '}
                          {plural(order.items.filter((i) => i.quantity > 0).length + order.extraItems.length, 'item', 'itens')}
                        </p>
                      </div>
                      {hasDivergence(order) && (
                        <span className="hidden rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 sm:inline">Divergência</span>
                      )}
                      <StatusPill status={order.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {historyOrders.length > historyLimit && (
              <button type="button" onClick={() => setHistoryLimit((n) => n + 30)} className={`${btnSecondary} mt-3 w-full`}>
                Mostrar mais ({historyOrders.length - historyLimit})
              </button>
            )}
          </>
        )}

        {/* barra de ações em lote */}
        {selectedOrders.length > 0 && (
          <div className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-3 lg:bottom-6 lg:left-64">
            <div className="mx-auto flex max-w-3xl animate-scale-in flex-wrap items-center gap-2 rounded-2xl bg-gray-900 p-2.5 text-white shadow-float">
              <span className="px-2 text-sm font-bold">{plural(selectedOrders.length, 'selecionado', 'selecionados')}</span>
              <div className="flex flex-1 flex-wrap justify-end gap-2">
                {selectedOrders.some((o) => o.status === 'RECEBIDO') && (
                  <button type="button" onClick={startSeparationBatch} className={`${btnPrimary} py-2`}>
                    Iniciar separação
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => print({ kind: 'picklist', orders: selectedOrders })}
                  className="press inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"
                >
                  <ListChecksIcon className="h-4 w-4" /> Lista de separação
                </button>
                <button
                  type="button"
                  onClick={() => print({ kind: 'orders', orders: selectedOrders })}
                  className="press inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"
                >
                  <PrinterIcon className="h-4 w-4" /> Guias
                </button>
                <button type="button" onClick={() => setSelected(new Set())} aria-label="Limpar seleção" className="press rounded-xl p-2 hover:bg-white/10">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="hidden print:block">
        {printJob?.kind === 'picklist' && <PickListPrint orders={printJob.orders} />}
        {printJob?.kind === 'orders' &&
          printJob.orders.map((order, index) => (
            <div key={order.id} className={index < printJob.orders.length - 1 ? 'break-after-page' : ''}>
              <OrderPrintSheet order={order} />
            </div>
          ))}
      </div>

      <OrderDetailSheet
        order={detail}
        onClose={() => setDetailId(null)}
        onUpdated={updateOrder}
        advanceLabel={(order) => NEXT_STEP[order.status]?.label ?? null}
        onAdvance={(order) => advance(order)}
        onEdit={(order) => setEditing(order)}
        onCancel={(order) => setCancelTarget(order)}
        onPrint={(order) => print({ kind: 'orders', orders: [order] })}
      />

      <OrderFulfillmentModal
        order={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          updateOrder(updated)
          setEditing(null)
        }}
      />

      <CancelOrderSheet
        order={cancelTarget}
        asAdmin
        onClose={() => setCancelTarget(null)}
        onCancelled={(updated) => {
          updateOrder(updated)
          setCancelTarget(null)
          setSelected((prev) => {
            const next = new Set(prev)
            next.delete(updated.id)
            return next
          })
        }}
      />

      <ConfirmDialog
        open={confirmShip !== null}
        title="Marcar como enviado?"
        message={
          <>
            O pedido da filial <strong>{confirmShip?.branch.name}</strong> sai da central e o estoque dos itens é baixado. A filial é
            avisada para confirmar quando chegar.
          </>
        }
        confirmLabel="Marcar como enviado"
        loading={updatingId === confirmShip?.id}
        onConfirm={async () => {
          if (!confirmShip) return
          await moveTo(confirmShip, 'ENVIADO')
          setConfirmShip(null)
        }}
        onCancel={() => setConfirmShip(null)}
      />

      <p className="sr-only" aria-live="polite">
        {STATUS_LABELS.RECEBIDO}: {counts.RECEBIDO}
      </p>
    </div>
  )
}
