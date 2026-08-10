import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { Item, ItemCategory, Order } from '../types'
import { usePendingOrders } from '../context/PendingOrdersContext'

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  PAPELARIA: 'Produtos Papelaria',
  LIMPEZA: 'Produtos Limpeza',
}

const CATEGORY_ORDER: ItemCategory[] = ['PAPELARIA', 'LIMPEZA']

interface ExtraRow {
  id: string
  name: string
  quantity: number
}

function createEmptyExtraRow(): ExtraRow {
  return { id: crypto.randomUUID(), name: '', quantity: 0 }
}

export default function NovoPedido() {
  const navigate = useNavigate()
  const { refreshPendingCount } = usePendingOrders()
  const [items, setItems] = useState<Item[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([createEmptyExtraRow()])
  const [loadingItems, setLoadingItems] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Item[]>('/items')
      .then(setItems)
      .catch(() => setError('Não foi possível carregar os itens'))
      .finally(() => setLoadingItems(false))
  }, [])

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

  async function handleSubmit() {
    setError(null)
    if (selectedItems.length === 0 && validExtraRows.length === 0) {
      setError('Selecione ao menos um item')
      return
    }
    setSubmitting(true)
    try {
      await api.post<Order>('/orders', {
        items: selectedItems.map(([itemId, quantity]) => ({ itemId, quantity })),
        extras: validExtraRows.map((row) => ({ name: row.name.trim(), quantity: row.quantity })),
      })
      refreshPendingCount()
      navigate('/pedidos')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingItems) {
    return <p className="text-gray-500">Carregando itens...</p>
  }

  const itemsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  const totalSelected = selectedItems.length + validExtraRows.length

  return (
    <div className="pb-24">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Novo pedido</h1>

      <div className="space-y-6">
        {itemsByCategory.map((group) => (
          <div key={group.category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
              {CATEGORY_LABELS[group.category]}
            </h2>
            <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
              {group.items.map((item) => {
                const quantity = quantities[item.id] ?? 0
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.unit}</p>
                    </div>
                    <div className="flex items-center justify-end gap-3 sm:justify-start">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={quantity === 0}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 shrink-0 text-center font-medium text-gray-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal"
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
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {extraRows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateExtraRow(row.id, { name: e.target.value })}
                  placeholder="Nome do item"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal sm:flex-1"
                />
                <div className="flex items-center justify-end gap-3 sm:justify-start">
                  <button
                    type="button"
                    onClick={() => updateExtraRow(row.id, { quantity: Math.max(0, row.quantity - 1) })}
                    disabled={row.quantity === 0}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 shrink-0 text-center font-medium text-gray-900">{row.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateExtraRow(row.id, { quantity: row.quantity + 1 })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal"
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

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-4">
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
    </div>
  )
}
