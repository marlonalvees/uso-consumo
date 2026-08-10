import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Order } from '../types'
import { STATUS_LABELS, STATUS_STYLES } from '../lib/orderStatus'
import { usePendingOrders } from '../context/PendingOrdersContext'

export default function MeusPedidos() {
  const { refreshPendingCount } = usePendingOrders()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Order[]>('/orders')
      .then(setOrders)
      .catch(() => setError('Não foi possível carregar os pedidos'))
      .finally(() => setLoading(false))
  }, [])

  async function handleConfirm(orderId: string) {
    setConfirmingId(orderId)
    setError(null)
    try {
      const updated = await api.patch<Order>(`/orders/${orderId}/confirm-delivery`)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      refreshPendingCount()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar a entrega')
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando pedidos...</p>
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Meus pedidos</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {orders.length === 0 && <p className="text-gray-500">Nenhum pedido feito ainda.</p>}
      <ul className="space-y-4">
        {orders.map((order) => (
          <li key={order.id} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{order.branch.name}</p>
                <span className="text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[order.status]}`}
              >
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <ul className="mb-3 space-y-1 text-sm text-gray-700">
              {order.items.map((orderItem) => (
                <li key={orderItem.id}>
                  {orderItem.quantity}x {orderItem.item.name} ({orderItem.item.unit})
                </li>
              ))}
            </ul>
            {order.status === 'ENVIADO' && (
              <button
                type="button"
                onClick={() => handleConfirm(order.id)}
                disabled={confirmingId === order.id}
                className="w-full rounded-lg bg-novamix-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-teal-dark disabled:opacity-60 sm:w-auto"
              >
                {confirmingId === order.id ? 'Confirmando...' : 'Confirmar recebimento'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
