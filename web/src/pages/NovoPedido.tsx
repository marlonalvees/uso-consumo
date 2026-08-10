import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { Item, Order } from '../types'
import { usePendingOrders } from '../context/PendingOrdersContext'

export default function NovoPedido() {
  const navigate = useNavigate()
  const { refreshPendingCount } = usePendingOrders()
  const [items, setItems] = useState<Item[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
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

  const selectedItems = Object.entries(quantities).filter(([, qty]) => qty > 0)

  async function handleSubmit() {
    setError(null)
    if (selectedItems.length === 0) {
      setError('Selecione ao menos um item')
      return
    }
    setSubmitting(true)
    try {
      await api.post<Order>('/orders', {
        items: selectedItems.map(([itemId, quantity]) => ({ itemId, quantity })),
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

  return (
    <div className="pb-24">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Novo pedido</h1>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
        {items.map((item) => {
          const quantity = quantities[item.id] ?? 0
          return (
            <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500">{item.unit}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, -1)}
                  disabled={quantity === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-6 text-center font-medium text-gray-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal"
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-4">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0}
            className="w-full rounded-lg bg-novamix-orange px-4 py-3 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark disabled:opacity-60"
          >
            {submitting
              ? 'Enviando...'
              : `Enviar pedido${
                  selectedItems.length
                    ? ` (${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'itens'})`
                    : ''
                }`}
          </button>
        </div>
      </div>
    </div>
  )
}
