import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, assetUrl } from '../lib/api'
import type { Purchase, PurchaseRecommendation, PurchasesPage, Supplier } from '../types'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate, plural } from '../lib/format'
import { btnPrimary, btnSecondary, btnTeal, cardClass, inputClass, labelClass, selectClass } from '../lib/ui'
import Tabs from '../components/ui/Tabs'
import Sheet from '../components/ui/Sheet'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import ItemSearchSelect from '../components/ItemSearchSelect'
import PhotoLightbox from '../components/PhotoLightbox'
import { CartIcon, CloseIcon, HistoryIcon, MessageIcon, PlusIcon, ReceiptIcon, SparklesIcon, TruckIcon } from '../components/icons'

type Tab = 'recomendacoes' | 'caminho' | 'registrar' | 'historico'

interface Row {
  id: string
  itemId: string
  quantity: number
  unitCost: string
}

function emptyRow(): Row {
  return { id: crypto.randomUUID(), itemId: '', quantity: 1, unitCost: '' }
}

function parseCost(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function whatsappLink(phone: string, supplierName: string, lines: { name: string; unit: string; quantity: number }[]) {
  const digits = phone.replace(/\D/g, '')
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits
  const body = lines.map((line) => `- ${line.name} (${line.unit}): ${line.quantity}`).join('\n')
  const message = `Olá, ${supplierName}! Segue pedido de compra:\n\n${body}\n\nObrigado!`
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}

function purchaseTotal(purchase: Purchase) {
  return purchase.items.reduce((sum, item) => sum + (item.receivedQuantity ?? item.quantity) * (item.unitCost ?? 0), 0)
}

function InvoiceButton({ purchase, onChanged }: { purchase: Purchase; onChanged: (purchase: Purchase) => void }) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [showPhoto, setShowPhoto] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande — máximo 5MB')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('invoice', file)
      onChanged(await api.upload<Purchase>(`/purchases/${purchase.id}/invoice`, formData))
      toast.success('Nota fiscal anexada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar a nota fiscal')
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    try {
      onChanged(await api.delete<Purchase>(`/purchases/${purchase.id}/invoice`))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível remover a nota fiscal')
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => (purchase.invoicePath ? setShowPhoto(true) : inputRef.current?.click())}
        disabled={uploading}
        className={`press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
          purchase.invoicePath ? 'bg-novamix-teal/10 text-novamix-teal' : 'bg-gray-100 text-gray-600'
        }`}
      >
        <ReceiptIcon className="h-3.5 w-3.5" />
        {uploading ? 'Enviando...' : purchase.invoicePath ? 'Ver nota' : 'Anexar nota'}
      </button>
      <PhotoLightbox
        src={showPhoto && purchase.invoicePath ? assetUrl(purchase.invoicePath) : null}
        alt={`Nota fiscal — ${purchase.supplier.name}`}
        onClose={() => setShowPhoto(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setShowPhoto(false)
                inputRef.current?.click()
              }}
              className={btnTeal}
            >
              Trocar foto
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPhoto(false)
                remove()
              }}
              className="press rounded-xl bg-red-base px-4 py-2.5 text-sm font-bold text-white"
            >
              Remover foto
            </button>
          </>
        }
      />
    </>
  )
}

/** Recebimento do pedido de compra: confere quantidade e custo de cada item. */
function ReceiveSheet({ purchase, onClose, onReceived }: { purchase: Purchase | null; onClose: () => void; onReceived: (purchase: Purchase) => void }) {
  const toast = useToast()
  const [lines, setLines] = useState<Record<string, { received: string; cost: string }>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!purchase) return
    setLines(
      Object.fromEntries(
        purchase.items.map((item) => [item.id, { received: String(item.quantity), cost: item.unitCost !== null ? String(item.unitCost).replace('.', ',') : '' }]),
      ),
    )
  }, [purchase])

  async function receive() {
    if (!purchase) return
    setSaving(true)
    try {
      const updated = await api.post<Purchase>(`/purchases/${purchase.id}/receive`, {
        items: purchase.items.map((item) => ({
          purchaseItemId: item.id,
          receivedQuantity: Math.max(0, Math.floor(Number(lines[item.id]?.received) || 0)),
          unitCost: parseCost(lines[item.id]?.cost ?? ''),
        })),
      })
      toast.success('Compra recebida — estoque e custo médio atualizados')
      onReceived(updated)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível receber a compra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={purchase !== null}
      onClose={onClose}
      dismissible={false}
      title="Receber compra"
      subtitle={purchase ? `${purchase.supplier.name} · pedido em ${formatDate(purchase.createdAt)}` : undefined}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`${btnSecondary} flex-1`}>
            Voltar
          </button>
          <button type="button" onClick={receive} disabled={saving} className={`${btnTeal} flex-2`}>
            {saving ? 'Recebendo...' : 'Dar entrada no estoque'}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-gray-600">Confira o que chegou. O custo unitário atualiza o custo médio do produto.</p>
      <ul className="space-y-2">
        {purchase?.items.map((item) => (
          <li key={item.id} className="rounded-2xl bg-gray-50 p-3">
            <p className="text-sm font-bold text-gray-900">{item.item.name}</p>
            <p className="mb-2 text-xs text-gray-500">
              Pedido: {item.quantity} {item.item.packaging.name}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-gray-600">
                Chegou
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={lines[item.id]?.received ?? ''}
                  onChange={(e) => setLines((prev) => ({ ...prev, [item.id]: { ...prev[item.id], received: e.target.value } }))}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Custo unitário (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  value={lines[item.id]?.cost ?? ''}
                  onChange={(e) => setLines((prev) => ({ ...prev, [item.id]: { ...prev[item.id], cost: e.target.value } }))}
                  placeholder="0,00"
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

export default function GestaoCompras() {
  const toast = useToast()
  const { items } = useItems()
  const [tab, setTab] = useState<Tab>('recomendacoes')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [recommendations, setRecommendations] = useState<PurchaseRecommendation[] | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [openPurchases, setOpenPurchases] = useState<Purchase[] | null>(null)
  const [history, setHistory] = useState<Purchase[] | null>(null)
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [receiving, setReceiving] = useState<Purchase | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  // registrar compra direta
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [submitting, setSubmitting] = useState(false)

  const loadRecommendations = useCallback(() => {
    api
      .get<PurchaseRecommendation[]>('/purchases/recommendations')
      .then((data) => {
        setRecommendations(data)
        setQuantities(Object.fromEntries(data.map((rec) => [rec.item.id, rec.recommendedQuantity])))
      })
      .catch(() => setRecommendations([]))
  }, [])

  const loadOpen = useCallback(() => {
    api
      .get<PurchasesPage>('/purchases?status=PEDIDO&take=100')
      .then((page) => setOpenPurchases(page.purchases))
      .catch(() => setOpenPurchases([]))
  }, [])

  const loadHistory = useCallback((cursor?: string) => {
    api
      .get<PurchasesPage>(`/purchases?take=20${cursor ? `&cursor=${cursor}` : ''}`)
      .then((page) => {
        const done = page.purchases.filter((p) => p.status !== 'PEDIDO')
        setHistory((prev) => (cursor ? [...(prev ?? []), ...done] : done))
        setHistoryCursor(page.nextCursor)
      })
      .catch(() => setHistory([]))
  }, [])

  useEffect(() => {
    api.get<Supplier[]>('/suppliers').then(setSuppliers).catch(() => {})
    loadRecommendations()
    loadOpen()
  }, [loadRecommendations, loadOpen])

  useEffect(() => {
    if (tab === 'historico' && history === null) loadHistory()
  }, [tab, history, loadHistory])

  const groups = (() => {
    const map = new Map<string, { supplier: Supplier | null; rows: PurchaseRecommendation[] }>()
    for (const rec of recommendations ?? []) {
      const key = rec.item.supplier?.id ?? '__sem__'
      const group = map.get(key) ?? { supplier: rec.item.supplier ?? null, rows: [] }
      group.rows.push(rec)
      map.set(key, group)
    }
    return [...map.values()]
  })()

  async function createPurchaseOrder(supplier: Supplier, recs: PurchaseRecommendation[]) {
    setCreatingFor(supplier.id)
    try {
      await api.post<Purchase>('/purchases', {
        supplierId: supplier.id,
        receiveNow: false,
        items: recs.filter((rec) => (quantities[rec.item.id] ?? 0) > 0).map((rec) => ({ itemId: rec.item.id, quantity: quantities[rec.item.id] })),
      })
      toast.success(`Pedido de compra registrado · ${supplier.name}`)
      loadRecommendations()
      loadOpen()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar o pedido de compra')
    } finally {
      setCreatingFor(null)
    }
  }

  async function cancelPurchase() {
    if (!cancelTarget) return
    try {
      await api.post(`/purchases/${cancelTarget.id}/cancel`)
      toast.success('Pedido de compra cancelado')
      setCancelTarget(null)
      loadOpen()
      loadRecommendations()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível cancelar')
    }
  }

  async function submitDirect() {
    if (!supplierId) {
      toast.error('Selecione o fornecedor')
      return
    }
    const valid = rows.filter((row) => row.itemId && row.quantity > 0)
    if (valid.length === 0) {
      toast.error('Adicione ao menos um item')
      return
    }
    setSubmitting(true)
    try {
      await api.post<Purchase>('/purchases', {
        supplierId,
        notes: notes.trim() || undefined,
        receiveNow: true,
        items: valid.map((row) => ({ itemId: row.itemId, quantity: row.quantity, unitCost: parseCost(row.unitCost) })),
      })
      toast.success('Compra registrada — estoque e custo médio atualizados')
      setSupplierId('')
      setNotes('')
      setRows([emptyRow()])
      setHistory(null)
      loadRecommendations()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar a compra')
    } finally {
      setSubmitting(false)
    }
  }

  const activeItems = items.filter((item) => item.active)

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900">Compras</h1>
      <p className="mb-4 text-sm text-gray-500">Do que comprar ao que chegou: o que está a caminho não aparece de novo na recomendação.</p>

      <Tabs
        variant="underline"
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'recomendacoes', label: 'O que comprar', icon: SparklesIcon, count: recommendations?.length ?? 0 },
          { value: 'caminho', label: 'A caminho', icon: TruckIcon, count: openPurchases?.length ?? 0 },
          { value: 'registrar', label: 'Registrar compra', icon: PlusIcon },
          { value: 'historico', label: 'Histórico', icon: HistoryIcon },
        ]}
      />

      {tab === 'recomendacoes' &&
        (recommendations === null ? (
          <SkeletonCards count={2} className="h-40" />
        ) : groups.length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={CartIcon} title="Nada para comprar agora" description="Todos os produtos estão acima do mínimo, contando o que está a caminho." />
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.supplier?.id ?? 'sem'} className={`${cardClass} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                  <div>
                    <p className="font-extrabold text-gray-900">{group.supplier?.name ?? 'Sem fornecedor definido'}</p>
                    <p className="text-xs text-gray-500">
                      {plural(group.rows.length, 'produto', 'produtos')}
                      {group.supplier?.leadTimeDays ? ` · entrega em ~${group.supplier.leadTimeDays} dias` : ''}
                    </p>
                  </div>
                  {group.supplier && (
                    <div className="flex flex-wrap gap-2">
                      {group.supplier.phone && (
                        <a
                          href={whatsappLink(
                            group.supplier.phone,
                            group.supplier.name,
                            group.rows.map((rec) => ({ name: rec.item.name, unit: rec.item.packaging.name, quantity: quantities[rec.item.id] ?? 0 })).filter((l) => l.quantity > 0),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="press inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white"
                        >
                          <MessageIcon className="h-4 w-4" /> WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => createPurchaseOrder(group.supplier!, group.rows)}
                        disabled={creatingFor === group.supplier.id}
                        className={`${btnPrimary} py-2`}
                      >
                        {creatingFor === group.supplier.id ? 'Registrando...' : 'Registrar pedido de compra'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-120 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500">
                      <tr>
                        <th className="px-4 py-2">Produto</th>
                        <th className="px-2 py-2 text-right">Estoque</th>
                        <th className="px-2 py-2 text-right">A caminho</th>
                        <th className="px-2 py-2 text-right">Consumo/dia</th>
                        <th className="px-4 py-2 text-right">Comprar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.rows.map((rec) => (
                        <tr key={rec.item.id}>
                          <td className="px-4 py-2">
                            <p className="font-semibold text-gray-900">{rec.item.name}</p>
                            <p className="text-xs text-gray-500">mínimo {rec.item.minStock} · {rec.item.packaging.name}</p>
                          </td>
                          <td className={`px-2 py-2 text-right font-bold tabular-nums ${rec.item.stockQuantity < 0 ? 'text-red-600' : 'text-gray-900'}`}>{rec.item.stockQuantity}</td>
                          <td className="px-2 py-2 text-right text-gray-600 tabular-nums">{rec.onOrderQuantity || '—'}</td>
                          <td className="px-2 py-2 text-right text-gray-600 tabular-nums">{rec.avgDailyConsumption ? rec.avgDailyConsumption.toLocaleString('pt-BR') : '—'}</td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={quantities[rec.item.id] ?? 0}
                              onChange={(e) => setQuantities((prev) => ({ ...prev, [rec.item.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                              aria-label={`Quantidade a comprar de ${rec.item.name}`}
                              className="w-20 rounded-xl border border-gray-200 px-2 py-1.5 text-center text-sm font-bold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ))}

      {tab === 'caminho' &&
        (openPurchases === null ? (
          <SkeletonCards count={2} />
        ) : openPurchases.length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={TruckIcon} title="Nenhuma compra a caminho" description="Registre um pedido de compra em “O que comprar”." />
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {openPurchases.map((purchase) => (
              <li key={purchase.id} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-gray-900">{purchase.supplier.name}</p>
                    <p className="text-xs text-gray-500">
                      Pedido em {formatDate(purchase.createdAt)}
                      {purchase.createdBy && ` por ${purchase.createdBy.name}`}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">A caminho</span>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {purchase.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="truncate text-gray-700">{item.item.name}</span>
                      <span className="shrink-0 font-bold tabular-nums">
                        {item.quantity} {item.item.packaging.name}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setReceiving(purchase)} className={`${btnTeal} flex-1`}>
                    Chegou — receber
                  </button>
                  <button type="button" onClick={() => setCancelTarget(purchase)} className={btnSecondary} aria-label="Cancelar pedido de compra">
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'registrar' && (
        <div className={`${cardClass} space-y-4 p-4`}>
          <p className="text-sm text-gray-600">Compra que já chegou: entra direto no estoque. Para comprar e esperar chegar, use “O que comprar”.</p>
          <div>
            <label htmlFor="purchase-supplier" className={labelClass}>
              Fornecedor
            </label>
            <select id="purchase-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${selectClass} w-full`}>
              <option value="">Selecione</option>
              {suppliers.filter((s) => s.active).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 p-2.5">
                <div className="min-w-52 flex-1">
                  <ItemSearchSelect items={activeItems} value={row.itemId} onChange={(itemId) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, itemId } : r)))} />
                </div>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={row.quantity}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : r)))}
                  aria-label="Quantidade"
                  className="w-20 rounded-xl border border-gray-200 px-2 py-2 text-center text-sm font-bold"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.unitCost}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, unitCost: e.target.value } : r)))}
                  placeholder="R$ unit."
                  aria-label="Custo unitário"
                  className="w-24 rounded-xl border border-gray-200 px-2 py-2 text-center text-sm"
                />
                <button type="button" onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev))} aria-label="Remover linha" className="rounded-full p-2 text-gray-400 hover:bg-gray-200">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="press inline-flex items-center gap-1.5 text-sm font-bold text-orange-base">
              <PlusIcon className="h-4 w-4" /> Outro produto
            </button>
          </div>
          <div>
            <label htmlFor="purchase-notes" className={labelClass}>
              Observação
            </label>
            <input id="purchase-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: nota fiscal 1234" className={inputClass} />
          </div>
          <button type="button" onClick={submitDirect} disabled={submitting} className={`${btnPrimary} w-full`}>
            {submitting ? 'Registrando...' : 'Registrar compra e dar entrada'}
          </button>
        </div>
      )}

      {tab === 'historico' &&
        (history === null ? (
          <SkeletonCards count={3} />
        ) : history.length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={HistoryIcon} title="Nenhuma compra ainda" compact />
          </div>
        ) : (
          <>
            <ul className={`${cardClass} divide-y divide-gray-100`}>
              {history.map((purchase) => {
                const total = purchaseTotal(purchase)
                return (
                  <li key={purchase.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{purchase.supplier.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(purchase.receivedAt ?? purchase.createdAt)} · {plural(purchase.items.length, 'item', 'itens')}
                        {purchase.receivedBy && ` · recebido por ${purchase.receivedBy.name}`}
                        {total > 0 && ` · ${formatCurrency(total)}`}
                      </p>
                    </div>
                    {purchase.status === 'CANCELADO' ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">Cancelada</span>
                    ) : (
                      <InvoiceButton purchase={purchase} onChanged={(updated) => setHistory((prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? null)} />
                    )}
                  </li>
                )
              })}
            </ul>
            {historyCursor && (
              <button type="button" onClick={() => loadHistory(historyCursor)} className={`${btnSecondary} mt-3 w-full`}>
                Carregar mais
              </button>
            )}
          </>
        ))}

      <ReceiveSheet
        purchase={receiving}
        onClose={() => setReceiving(null)}
        onReceived={() => {
          setReceiving(null)
          loadOpen()
          loadRecommendations()
          setHistory(null)
        }}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancelar pedido de compra?"
        message={<>O pedido para <strong>{cancelTarget?.supplier.name}</strong> sai de “a caminho” e os itens voltam para a recomendação.</>}
        confirmLabel="Cancelar pedido"
        danger
        onConfirm={cancelPurchase}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
