import { useEffect, useMemo, useState } from 'react'
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

type DatePreset = 'todos' | 'hoje' | 'ontem' | 'semana' | 'mes' | 'periodo'

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'semana', label: 'Essa semana' },
  { value: 'mes', label: 'Esse mês' },
  { value: 'periodo', label: 'Período' },
]

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date)
  const day = copy.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diffToMonday)
  return copy
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function matchesDatePreset(
  dateIso: string,
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): boolean {
  if (preset === 'todos') return true

  const date = new Date(dateIso)
  const now = new Date()

  if (preset === 'hoje') {
    return startOfDay(date).getTime() === startOfDay(now).getTime()
  }
  if (preset === 'ontem') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return startOfDay(date).getTime() === startOfDay(yesterday).getTime()
  }
  if (preset === 'semana') {
    return date >= startOfWeek(now)
  }
  if (preset === 'mes') {
    return date >= startOfMonth(now)
  }
  if (preset === 'periodo') {
    if (customStart && date < startOfDay(new Date(customStart))) return false
    if (customEnd) {
      const end = new Date(customEnd)
      end.setHours(23, 59, 59, 999)
      if (date > end) return false
    }
    return true
  }
  return true
}

export default function GestaoPedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { printingOrder, printOrder } = usePrintOrder()

  const [datePreset, setDatePreset] = useState<DatePreset>('todos')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterBranch, setFilterBranch] = useState<number | ''>('')
  const [filterUser, setFilterUser] = useState<number | ''>('')
  const [filterItem, setFilterItem] = useState('')

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

  const branchOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const order of orders) map.set(order.branch.id, order.branch.name)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [orders])

  const userOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const order of orders) map.set(order.requestedBy.id, order.requestedBy.name)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [orders])

  const itemOptions = useMemo(() => {
    const set = new Set<string>()
    for (const order of orders) {
      for (const orderItem of order.items) set.add(orderItem.item.name)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [orders])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterBranch && order.branch.id !== filterBranch) return false
      if (filterUser && order.requestedBy.id !== filterUser) return false
      if (filterItem && !order.items.some((oi) => oi.item.name === filterItem)) return false
      if (!matchesDatePreset(order.createdAt, datePreset, customStart, customEnd)) return false
      return true
    })
  }, [orders, filterBranch, filterUser, filterItem, datePreset, customStart, customEnd])

  if (loading) {
    return <p className="text-gray-500">Carregando pedidos...</p>
  }

  return (
    <div>
      <div className="print:hidden">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {orders.length > 0 && (
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
              {DATE_PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDatePreset(option.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    datePreset === option.value
                      ? 'bg-novamix-teal/10 text-novamix-teal'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {datePreset === 'periodo' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <span className="text-sm text-gray-500">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value ? Number(e.target.value) : '')}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Todas as filiais</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value ? Number(e.target.value) : '')}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Todos os usuários</option>
                {userOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>

              <select
                value={filterItem}
                onChange={(e) => setFilterItem(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Todos os itens</option>
                {itemOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <p className="text-gray-500">Nenhum pedido ainda.</p>
        ) : filteredOrders.length === 0 ? (
          <p className="text-gray-500">Nenhum pedido encontrado com esses filtros.</p>
        ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Filial</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Solicitante</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Data</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Itens</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Qtd. total</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Estágio</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => {
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
                    <td className="px-4 py-3 text-gray-600">{order.requestedBy.name}</td>
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
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
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
