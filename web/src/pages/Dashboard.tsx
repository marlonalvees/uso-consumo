import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Order, OrderStatus } from '../types'
import { STATUS_LABELS, STATUS_STYLES } from '../lib/orderStatus'
import OrderPrintSheet from '../components/OrderPrintSheet'
import { usePrintOrder } from '../hooks/usePrintOrder'

const ADMIN_SETTABLE_STATUSES: OrderStatus[] = [
  'PENDENTE',
  'EM_SEPARACAO',
  'AGUARDANDO_ENVIO',
  'ENVIADO',
]

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { printingOrder, printOrder } = usePrintOrder()

  useEffect(() => {
    api
      .get<Order[]>('/orders')
      .then(setOrders)
      .catch(() => setError('Não foi possível carregar os pedidos'))
      .finally(() => setLoading(false))
  }, [])

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId)
    setError(null)
    try {
      const updated = await api.patch<Order>(`/orders/${orderId}/status`, { status })
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando pedidos...</p>
  }

  return (
    <div>
      <div className="print:hidden">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900">Dashboard</h1>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {orders.length === 0 ? (
          <p className="text-gray-500">Nenhum pedido ainda.</p>
        ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Filial</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Data</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Itens</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Qtd. total</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Estágio</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => {
                const totalQty =
                  order.items.reduce((sum, i) => sum + i.quantity, 0) +
                  order.extraItems.reduce((sum, i) => sum + i.quantity, 0)
                const itemsLabel = [
                  ...order.items.map((i) => `${i.quantity}x ${i.item.name}`),
                  ...order.extraItems.map((i) => `${i.quantity}x ${i.name} (extra)`),
                ].join(', ')
                return (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{order.branch.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{itemsLabel}</td>
                    <td className="px-4 py-3 text-gray-600">{totalQty}</td>
                    <td className="px-4 py-3">
                      {order.status === 'ENTREGUE' ? (
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      ) : (
                        <select
                          value={order.status}
                          disabled={updatingId === order.id}
                          onChange={(e) =>
                            handleStatusChange(order.id, e.target.value as OrderStatus)
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        >
                          {ADMIN_SETTABLE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => printOrder(order)}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        Imprimir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      <div className="hidden print:block">
        {printingOrder && <OrderPrintSheet order={printingOrder} />}
      </div>
    </div>
  )
}
