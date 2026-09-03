import { useState } from 'react'
import { api, ApiError, assetUrl } from '../lib/api'
import type { Branch, Item, Order } from '../types'
import { useOrders } from '../context/OrdersContext'
import { useItems } from '../context/ItemsContext'
import { useAuth } from '../context/AuthContext'
import { useCategories } from '../context/CategoriesContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import PhotoLightbox from '../components/PhotoLightbox'
import { ImageIcon, SearchIcon, ZoomInIcon } from '../components/icons'
import { normalizeText } from '../lib/text'
import { STATUS_LABELS } from '../lib/orderStatus'

interface ExtraRow {
  id: string
  name: string
  quantity: number
}

function createEmptyExtraRow(): ExtraRow {
  return { id: crypto.randomUUID(), name: '', quantity: 0 }
}

interface NovoPedidoProps {
  readOnly?: boolean
  branches?: Branch[]
  hideTitle?: boolean
  onSuccess?: () => void
  onViewMyOrders?: () => void
}

export default function NovoPedido({
  readOnly = false,
  branches: branchesProp,
  hideTitle = false,
  onSuccess,
  onViewMyOrders,
}: NovoPedidoProps = {}) {
  const { addOrder, myActiveOrder } = useOrders()
  const { items, loadingItems } = useItems()
  const { user } = useAuth()
  const { categories } = useCategories()
  const toast = useToast()
  const branches = branchesProp ?? user?.branches ?? []
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([createEmptyExtraRow()])
  const [branchId, setBranchId] = useState<number | ''>(branches.length === 1 ? branches[0].id : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [previewItem, setPreviewItem] = useState<Item | null>(null)

  function updateQuantity(itemId: string, delta: number) {
    setQuantities((prev) => {
      const current = prev[itemId] ?? 0
      const next = Math.max(0, current + delta)
      return { ...prev, [itemId]: next }
    })
  }

  function updateExtraRow(id: string, patch: Partial<ExtraRow>) {
    setExtraRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addExtraRow() {
    setExtraRows((prev) => [...prev, createEmptyExtraRow()])
  }

  function removeExtraRow(id: string) {
    setExtraRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev))
  }

  const selectedItems = Object.entries(quantities).filter(([, qty]) => qty > 0)
  const validExtraRows = extraRows.filter((row) => row.name.trim().length > 0 && row.quantity > 0)

  function handleSubmit() {
    setError(null)
    if (selectedItems.length === 0 && validExtraRows.length === 0) {
      setError('Selecione ao menos um item')
      return
    }
    setConfirmError(null)
    setConfirmOpen(true)
  }

  async function handleConfirmSubmit() {
    if (!branchId) {
      setConfirmError('Selecione a filial')
      return
    }
    setConfirmError(null)
    setSubmitting(true)
    try {
      const created = await api.post<Order>('/orders', {
        branchId,
        items: selectedItems.map(([itemId, quantity]) => ({ itemId, quantity })),
        extras: validExtraRows.map((row) => ({ name: row.name.trim(), quantity: row.quantity })),
      })
      addOrder(created)
      setQuantities({})
      setExtraRows([createEmptyExtraRow()])
      setConfirmOpen(false)
      toast.success('Pedido enviado com sucesso!')
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingItems) {
    return <p className="text-gray-500">Carregando itens...</p>
  }

  const normalizedSearch = normalizeText(search)
  const visibleItems = items.filter((item) => {
    if (categoryFilter && item.categoryId !== categoryFilter) return false
    if (normalizedSearch && !normalizeText(item.name).includes(normalizedSearch)) return false
    return true
  })

  const categoriesWithItems = categories.filter((category) =>
    items.some((item) => item.categoryId === category.id),
  )

  const categoriesById = new Map(visibleItems.map((item) => [item.categoryId, item.category]))
  const itemsByCategory = [...categoriesById.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => ({
      category,
      items: visibleItems.filter((item) => item.categoryId === category.id),
    }))

  const totalSelected = selectedItems.length + validExtraRows.length

  if (!readOnly && branches.length === 0) {
    return (
      <div>
        {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Novo pedido</h1>}
        <p className="text-gray-500">
          Nenhuma filial liberada para você. Fale com o administrador do hub.
        </p>
      </div>
    )
  }

  if (!readOnly && myActiveOrder) {
    return (
      <div>
        {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Novo pedido</h1>}
        <div className="rounded-xl border border-novamix-orange/30 bg-novamix-orange/5 p-4">
          <p className="text-sm text-gray-700">
            Você já tem um pedido <strong>{STATUS_LABELS[myActiveOrder.status].toLowerCase()}</strong>{' '}
            para a filial <strong>{myActiveOrder.branch.name}</strong>. Aguarde a finalização desse
            pedido antes de criar um novo.
          </p>
          {onViewMyOrders && (
            <button
              type="button"
              onClick={onViewMyOrders}
              className="mt-3 rounded-lg bg-novamix-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-teal-dark"
            >
              Ver meus pedidos
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={readOnly ? '' : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'}>
      {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Novo pedido</h1>}

      <div className="relative mb-3">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
        />
      </div>

      {categoriesWithItems.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              categoryFilter === ''
                ? 'bg-novamix-orange text-white hover:bg-novamix-orange-dark'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-gray-900'
            }`}
          >
            Todas
          </button>
          {categoriesWithItems.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryFilter(category.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                categoryFilter === category.id
                  ? 'bg-novamix-orange text-white hover:bg-novamix-orange-dark'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-gray-900'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {itemsByCategory.length === 0 && (
        <p className="mb-6 text-sm text-gray-500">
          {normalizedSearch ? `Nenhum produto encontrado para "${search.trim()}".` : 'Nenhum produto nessa categoria.'}
        </p>
      )}

      <div className="space-y-5">
        {itemsByCategory.map((group) => (
          <div key={group.category.id}>
            {categoryFilter === '' && (
              <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
                {group.category.name}
              </h2>
            )}
            <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
              {group.items.map((item) => {
                const quantity = quantities[item.id] ?? 0
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => item.photoPath && setPreviewItem(item)}
                        aria-label={item.photoPath ? `Ver foto de ${item.name}` : undefined}
                        className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-300 ${
                          item.photoPath ? '' : 'pointer-events-none'
                        }`}
                      >
                        {item.photoPath ? (
                          <>
                            <img
                              src={assetUrl(item.photoPath)}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition hover:bg-black/30 hover:opacity-100">
                              <ZoomInIcon className="h-4 w-4" />
                            </span>
                          </>
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.packaging.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2.5 sm:justify-start">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={quantity === 0}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        −
                      </button>
                      <span className="w-6 shrink-0 text-center font-medium text-gray-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal transition hover:bg-novamix-teal/10"
                      >
                        +
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
            Extras — escreva abaixo
          </h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {extraRows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateExtraRow(row.id, { name: e.target.value })}
                  placeholder="Nome do item"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal sm:flex-1"
                />
                <div className="flex items-center justify-end gap-3 sm:justify-start">
                  <button
                    type="button"
                    onClick={() => updateExtraRow(row.id, { quantity: Math.max(0, row.quantity - 1) })}
                    disabled={row.quantity === 0}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    −
                  </button>
                  <span className="w-6 shrink-0 text-center font-medium text-gray-900">{row.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateExtraRow(row.id, { quantity: row.quantity + 1 })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal transition hover:bg-novamix-teal/10"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExtraRow(row.id)}
                    disabled={extraRows.length === 1}
                    className="shrink-0 px-1 text-lg text-gray-400 hover:text-red-500 disabled:opacity-0"
                    aria-label="Remover linha"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addExtraRow}
            className="mt-2 text-sm font-medium text-novamix-teal hover:text-novamix-teal-dark"
          >
            + adicionar linha
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:left-64">
          <div className="mx-auto max-w-5xl">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || totalSelected === 0}
              className="w-full rounded-lg bg-novamix-orange px-4 py-3 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark disabled:opacity-60"
            >
              {submitting
                ? 'Enviando...'
                : `Enviar pedido${
                    totalSelected ? ` (${totalSelected} ${totalSelected === 1 ? 'item' : 'itens'})` : ''
                  }`}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar envio do pedido"
        message={
          <>
            <p>
              Você está enviando <strong>{totalSelected}</strong>{' '}
              {totalSelected === 1 ? 'item' : 'itens'}. Depois de enviado, a central vai conferir o
              que tem em estoque antes de despachar.
            </p>
            <div className="mt-3">
              <label htmlFor="confirm-branch" className="mb-1 block text-xs font-medium text-gray-500">
                Para qual filial é esse pedido?
              </label>
              {branches.length === 1 ? (
                <p className="text-sm font-medium text-gray-900">{branches[0].name}</p>
              ) : (
                <select
                  id="confirm-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
                >
                  <option value="" disabled>
                    Selecione a filial
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              )}
              {confirmError && <p className="mt-2 text-sm text-red-600">{confirmError}</p>}
            </div>
          </>
        }
        confirmLabel="Enviar pedido"
        loading={submitting}
        onConfirm={handleConfirmSubmit}
        onCancel={() => {
          setConfirmOpen(false)
          setConfirmError(null)
        }}
      />

      <PhotoLightbox
        src={previewItem?.photoPath ? assetUrl(previewItem.photoPath) : null}
        alt={previewItem?.name ?? ''}
        onClose={() => setPreviewItem(null)}
      />
    </div>
  )
}
