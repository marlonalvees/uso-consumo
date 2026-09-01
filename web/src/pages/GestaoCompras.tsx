import { useEffect, useRef, useState } from 'react'
import { api, ApiError, assetUrl } from '../lib/api'
import type { Item, Purchase, PurchaseRecommendation, Supplier } from '../types'
import { useToast } from '../context/ToastContext'
import { CloseIcon, MessageIcon, ReceiptIcon } from '../components/icons'
import PhotoLightbox from '../components/PhotoLightbox'

interface PurchaseRow {
  id: string
  itemId: string
  quantity: number
}

function createEmptyRow(): PurchaseRow {
  return { id: crypto.randomUUID(), itemId: '', quantity: 1 }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function buildWhatsAppLink(phone: string, supplierName: string, rows: PurchaseRecommendation[]): string {
  const digits = phone.replace(/\D/g, '')
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits
  const lines = rows.map(
    (rec) => `- ${rec.item.name} (${rec.item.packaging.name}): ${rec.recommendedQuantity}`,
  )
  const message = `Olá, ${supplierName}! Segue pedido de compra:\n\n${lines.join('\n')}\n\nObrigado!`
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}

function groupRecommendationsBySupplier(recommendations: PurchaseRecommendation[]) {
  const groups: { supplierId: string | null; supplierName: string; rows: PurchaseRecommendation[] }[] = []
  const indexBySupplier = new Map<string, number>()
  for (const rec of recommendations) {
    const key = rec.item.supplier?.id ?? '__none__'
    if (!indexBySupplier.has(key)) {
      indexBySupplier.set(key, groups.length)
      groups.push({
        supplierId: rec.item.supplier?.id ?? null,
        supplierName: rec.item.supplier?.name ?? 'Sem fornecedor definido',
        rows: [],
      })
    }
    groups[indexBySupplier.get(key)!].rows.push(rec)
  }
  return groups
}

interface InvoiceCellProps {
  purchase: Purchase
  uploading: boolean
  onSelect: (purchase: Purchase, file: File) => void
  onRemove: (purchase: Purchase) => void
}

function InvoiceCell({ purchase, uploading, onSelect, onRemove }: InvoiceCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showLightbox, setShowLightbox] = useState(false)

  function handleClick() {
    if (purchase.invoicePath) {
      setShowLightbox(true)
    } else {
      inputRef.current?.click()
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
          if (file) onSelect(purchase, file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
          purchase.invoicePath
            ? 'border-novamix-teal text-novamix-teal hover:bg-novamix-teal/10'
            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <ReceiptIcon className="h-3.5 w-3.5" />
        {uploading ? 'Enviando...' : purchase.invoicePath ? 'Ver nota' : 'Anexar nota'}
      </button>

      <PhotoLightbox
        src={showLightbox && purchase.invoicePath ? assetUrl(purchase.invoicePath) : null}
        alt={`Nota fiscal — ${purchase.supplier.name}`}
        onClose={() => setShowLightbox(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setShowLightbox(false)
                inputRef.current?.click()
              }}
              className="rounded-lg bg-novamix-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-teal-dark"
            >
              Trocar foto
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLightbox(false)
                onRemove(purchase)
              }}
              className="rounded-lg bg-red-base px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-base/90"
            >
              Remover foto
            </button>
          </>
        }
      />
    </>
  )
}

export default function GestaoCompras() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [recommendations, setRecommendations] = useState<PurchaseRecommendation[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<PurchaseRow[]>([createEmptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [invoiceUploadingId, setInvoiceUploadingId] = useState<string | null>(null)

  function loadAll() {
    Promise.all([
      api.get<Supplier[]>('/suppliers'),
      api.get<Item[]>('/items'),
      api.get<PurchaseRecommendation[]>('/purchases/recommendations'),
      api.get<Purchase[]>('/purchases'),
    ])
      .then(([suppliersData, itemsData, recommendationsData, purchasesData]) => {
        setSuppliers(suppliersData)
        setItems(itemsData)
        setRecommendations(recommendationsData)
        setPurchases(purchasesData)
      })
      .catch(() => toast.error('Não foi possível carregar os dados de compras'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadAll, [])

  function updateRow(id: string, patch: Partial<PurchaseRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()])
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev))
  }

  function handleSupplierChange(value: string) {
    setSupplierId(value)
    setRows([createEmptyRow()])
  }

  function applyRecommendation(group: ReturnType<typeof groupRecommendationsBySupplier>[number]) {
    if (!group.supplierId) {
      toast.error('Defina um fornecedor para esses produtos em Cadastros antes de comprar')
      return
    }
    setSupplierId(group.supplierId)
    setRows(
      group.rows.map((rec) => ({ id: crypto.randomUUID(), itemId: rec.item.id, quantity: rec.recommendedQuantity })),
    )
    setShowRecommendations(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!supplierId) {
      toast.error('Selecione o fornecedor')
      return
    }
    const validRows = rows.filter((row) => row.itemId && row.quantity > 0)
    if (validRows.length === 0) {
      toast.error('Adicione ao menos um item com quantidade maior que 0')
      return
    }

    setSubmitting(true)
    try {
      await api.post<Purchase>('/purchases', {
        supplierId,
        notes: notes.trim() || undefined,
        items: validRows.map((row) => ({ itemId: row.itemId, quantity: row.quantity })),
      })
      toast.success('Compra registrada — estoque atualizado')
      setSupplierId('')
      setNotes('')
      setRows([createEmptyRow()])
      loadAll()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar a compra')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleInvoiceSelect(purchase: Purchase, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande — máximo 5MB')
      return
    }
    setInvoiceUploadingId(purchase.id)
    try {
      const formData = new FormData()
      formData.append('invoice', file)
      const updated = await api.upload<Purchase>(`/purchases/${purchase.id}/invoice`, formData)
      setPurchases((prev) => prev.map((p) => (p.id === purchase.id ? updated : p)))
      toast.success('Nota fiscal anexada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar a nota fiscal')
    } finally {
      setInvoiceUploadingId(null)
    }
  }

  async function handleInvoiceRemove(purchase: Purchase) {
    setInvoiceUploadingId(purchase.id)
    try {
      const updated = await api.delete<Purchase>(`/purchases/${purchase.id}/invoice`)
      setPurchases((prev) => prev.map((p) => (p.id === purchase.id ? updated : p)))
      toast.success('Nota fiscal removida')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível remover a nota fiscal')
    } finally {
      setInvoiceUploadingId(null)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando compras...</p>
  }

  const recommendationGroups = groupRecommendationsBySupplier(recommendations)
  const supplierItems = supplierId ? items.filter((item) => item.supplierId === supplierId) : []

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
          Registrar compra
        </h2>
        <button
          type="button"
          onClick={() => setShowRecommendations(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-novamix-teal px-3 py-1.5 text-xs font-medium text-novamix-teal transition hover:bg-novamix-teal/10"
        >
          Recomendações de compra
          {recommendationGroups.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-novamix-teal px-1 text-xs font-semibold text-white">
              {recommendations.length}
            </span>
          )}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Fornecedor</label>
            <select
              value={supplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
            >
              <option value="">Selecione o fornecedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Observações (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="Ex: nota fiscal 1234"
            />
          </div>
        </div>

        {!supplierId ? (
          <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
            Selecione um fornecedor para escolher os produtos.
          </p>
        ) : supplierItems.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
            Esse fornecedor não tem produtos cadastrados.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <select
                    value={row.itemId}
                    onChange={(e) => updateRow(row.id, { itemId: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                  >
                    <option value="">Selecione o produto</option>
                    {supplierItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    aria-label="Remover linha"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90 disabled:opacity-0"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 text-sm font-medium text-novamix-teal hover:text-novamix-teal-dark"
            >
              + adicionar item
            </button>
          </>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-novamix-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark disabled:opacity-60"
          >
            {submitting ? 'Registrando...' : 'Registrar compra'}
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
        Histórico de compras
      </h2>
      {purchases.length === 0 ? (
        <p className="text-gray-500">Nenhuma compra registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Data</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Fornecedor</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Itens</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Qtd. total</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Nota fiscal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {purchases.map((purchase) => {
                const totalQty = purchase.items.reduce((sum, i) => sum + i.quantity, 0)
                const itemsLabel = purchase.items.map((i) => `${i.quantity}x ${i.item.name}`).join(', ')
                return (
                  <tr key={purchase.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(purchase.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{purchase.supplier.name}</td>
                    <td className="px-4 py-3 text-gray-600">{itemsLabel}</td>
                    <td className="px-4 py-3 text-gray-600">{totalQty}</td>
                    <td className="px-4 py-3">
                      <InvoiceCell
                        purchase={purchase}
                        uploading={invoiceUploadingId === purchase.id}
                        onSelect={handleInvoiceSelect}
                        onRemove={handleInvoiceRemove}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showRecommendations && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowRecommendations(false)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Recomendação de compra</h2>
              <button
                type="button"
                onClick={() => setShowRecommendations(false)}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-400 text-white transition hover:bg-gray-500"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {recommendationGroups.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum produto abaixo do estoque mínimo no momento.</p>
              ) : (
                <div className="space-y-3">
                  {recommendationGroups.map((group) => {
                    const supplierPhone = suppliers.find((s) => s.id === group.supplierId)?.phone
                    return (
                      <div key={group.supplierId ?? '__none__'} className="rounded-xl border border-gray-200 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900">{group.supplierName}</p>
                          <div className="flex gap-2">
                            {supplierPhone && (
                              <a
                                href={buildWhatsAppLink(supplierPhone, group.supplierName, group.rows)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Enviar pedido por WhatsApp"
                                title="Enviar pedido por WhatsApp"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white transition hover:bg-green-700"
                              >
                                <MessageIcon className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => applyRecommendation(group)}
                              className="rounded-lg border border-novamix-teal px-3 py-1 text-xs font-medium text-novamix-teal transition hover:bg-novamix-teal/10"
                            >
                              Usar nessa compra
                            </button>
                          </div>
                        </div>
                        <ul className="space-y-1 text-sm text-gray-600">
                          {group.rows.map((rec) => (
                            <li key={rec.item.id} className="flex items-center justify-between gap-2">
                              <span>{rec.item.name}</span>
                              <span className="text-gray-500">
                                estoque {rec.item.stockQuantity}/{rec.item.minStock} · comprar{' '}
                                <strong className="text-gray-900">{rec.recommendedQuantity}</strong>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
