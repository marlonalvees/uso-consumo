import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Order, OrderStatus } from '../types'
import { DATE_PRESET_OPTIONS, matchesDatePreset, type DatePreset } from '../lib/dateFilter'
import OrderPrintSheet from '../components/OrderPrintSheet'
import OrderFulfillmentModal from '../components/OrderFulfillmentModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePrintOrder } from '../hooks/usePrintOrder'
import { useOrders } from '../context/OrdersContext'
import { useToast } from '../context/ToastContext'

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: 'RECEBIDO', label: 'Recebidos' },
  { status: 'EM_ANDAMENTO', label: 'Em andamento' },
  { status: 'ENVIADO', label: 'Enviados' },
  { status: 'ENTREGUE', label: 'Entregues' },
]

interface OrderCardProps {
  order: Order
  highlighted: boolean
  updating: boolean
  onEditItems?: () => void
  onAdvance?: { label: string; onClick: () => void }
  onPrint: () => void
}

function OrderCard({ order, highlighted, updating, onEditItems, onAdvance, onPrint }: OrderCardProps) {
  const totalQty =
    order.items.reduce((sum, i) => sum + i.quantity, 0) +
    order.extraItems.reduce((sum, i) => sum + i.quantity, 0)
  const itemsLabel =
    [
      ...order.items.filter((i) => i.quantity > 0).map((i) => `${i.quantity}x ${i.item.name}`),
      ...order.extraItems.filter((i) => i.quantity > 0).map((i) => `${i.quantity}x ${i.name}`),
    ].join(', ') || 'Sem itens confirmados'

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-700 ${
        highlighted ? 'ring-2 ring-novamix-orange' : ''
      }`}
    >
      <p className="text-sm font-semibold text-gray-900">{order.branch.name}</p>
      <p className="text-xs text-gray-500">
        {new Date(order.createdAt).toLocaleDateString('pt-BR')} · {order.requestedBy.name}
      </p>
      <p className="mt-2 line-clamp-3 text-xs text-gray-600">{itemsLabel}</p>
      <p className="mt-1 text-xs text-gray-400">{totalQty} unidades no total</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {onEditItems && (
          <button
            type="button"
            onClick={onEditItems}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Editar itens
          </button>
        )}
        {onAdvance && (
          <button
            type="button"
            onClick={onAdvance.onClick}
            disabled={updating}
            className="rounded-lg bg-novamix-teal px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-novamix-teal-dark disabled:opacity-60"
          >
            {updating ? 'Aguarde...' : onAdvance.label}
          </button>
        )}
        <button
          type="button"
          onClick={onPrint}
          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Imprimir
        </button>
      </div>
    </div>
  )
}

interface GestaoPedidosProps {
  // estágio a destacar, vindo da barra de status do topo (ver Administracao)
  highlightStatus?: OrderStatus | null
}

export default function GestaoPedidos({ highlightStatus = null }: GestaoPedidosProps) {
  // mesma lista da barra de status do topo: o que muda aqui reflete na barra na hora
  const { orders, loadingOrders: loading, refreshOrders, updateOrder } = useOrders()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [confirmShip, setConfirmShip] = useState<Order | null>(null)
  const { printingOrder, printOrder } = usePrintOrder()
  const toast = useToast()

  const [datePreset, setDatePreset] = useState<DatePreset>('todos')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterBranch, setFilterBranch] = useState<number | ''>('')
  const [filterUser, setFilterUser] = useState<number | ''>('')
  const [filterItem, setFilterItem] = useState('')

  useEffect(() => {
    refreshOrders()
  }, [refreshOrders])

  useEffect(() => {
    if (!highlightStatus || loading) return
    document
      .getElementById(`coluna-${highlightStatus}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [highlightStatus, loading])

  async function handleStatusChange(orderId: string, status: OrderStatus, successMessage: string) {
    setUpdatingId(orderId)
    try {
      const updated = await api.patch<Order>(`/orders/${orderId}/status`, { status })
      updateOrder(updated)
      toast.success(successMessage)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleConfirmShip() {
    if (!confirmShip) return
    await handleStatusChange(confirmShip.id, 'ENVIADO', 'Pedido marcado como enviado')
    setConfirmShip(null)
  }

  function handleFulfillmentSaved(updated: Order) {
    updateOrder(updated)
    setEditingOrder(null)
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

  const columns = COLUMNS.map((col) => ({
    ...col,
    orders: filteredOrders.filter((o) => o.status === col.status),
  }))

  return (
    <div>
      <div className="print:hidden">
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {columns.map((col) => (
              <div
                key={col.status}
                id={`coluna-${col.status}`}
                className="flex min-w-0 scroll-mt-20 flex-col rounded-xl border border-gray-200 bg-gray-50 p-3 lg:scroll-mt-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">{col.label}</h2>
                  <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-500">
                    {col.orders.length}
                  </span>
                </div>
                <div className="flex flex-col gap-3 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
                  {col.orders.length === 0 ? (
                    <p className="text-xs text-gray-400">Nenhum pedido nesta etapa.</p>
                  ) : (
                    col.orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        highlighted={highlightStatus === col.status}
                        updating={updatingId === order.id}
                        onPrint={() => printOrder(order)}
                        onEditItems={() => setEditingOrder(order)}
                        onAdvance={
                          col.status === 'RECEBIDO'
                            ? {
                                label: 'Iniciar separação',
                                onClick: () =>
                                  handleStatusChange(order.id, 'EM_ANDAMENTO', 'Pedido em separação'),
                              }
                            : col.status === 'EM_ANDAMENTO'
                              ? { label: 'Marcar como enviado', onClick: () => setConfirmShip(order) }
                              : undefined
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hidden print:block">
        {printingOrder && <OrderPrintSheet order={printingOrder} />}
      </div>

      <OrderFulfillmentModal
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSaved={handleFulfillmentSaved}
      />

      <ConfirmDialog
        open={confirmShip !== null}
        title="Marcar pedido como enviado"
        message={
          <>
            Confirma o envio do pedido da filial <strong>{confirmShip?.branch.name}</strong>? O
            estoque dos itens será baixado.
          </>
        }
        confirmLabel="Marcar como enviado"
        loading={updatingId === confirmShip?.id}
        onConfirm={handleConfirmShip}
        onCancel={() => setConfirmShip(null)}
      />
    </div>
  )
}
