import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Order } from '../types'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import { useOrderEvents } from '../hooks/useOrderEvents'
import { useNavigationFocus } from '../hooks/useNavigationFocus'
import { usePrintOrder } from '../hooks/usePrintOrder'
import { formatDateTime, orderCode } from '../lib/format'
import { btnPrimary, btnSecondary, btnTeal, cardClass } from '../lib/ui'
import OrderTracker from '../components/orders/OrderTracker'
import OrderItemsList from '../components/orders/OrderItemsList'
import OrderTimeline from '../components/orders/OrderTimeline'
import CancelOrderSheet from '../components/orders/CancelOrderSheet'
import ReceiptSheet from '../components/orders/ReceiptSheet'
import OrderFulfillmentModal from '../components/OrderFulfillmentModal'
import OrderPrintSheet from '../components/OrderPrintSheet'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import Menu from '../components/ui/Menu'
import { BagIcon, BanIcon, ChevronDownIcon, EditIcon, NoteIcon, PackageCheckIcon, PlusIcon, PrinterIcon, TruckIcon } from '../components/icons'

function TrackerCard({
  order,
  focused,
  onReceive,
  onCancel,
  onEdit,
  onPrint,
  onAddItems,
}: {
  order: Order
  focused: boolean
  onReceive: () => void
  onCancel: () => void
  onEdit: () => void
  onPrint: () => void
  onAddItems: () => void
}) {
  const events = useOrderEvents(order)
  const [showHistory, setShowHistory] = useState(false)
  const itemCount = order.items.filter((i) => i.quantity > 0).length + order.extraItems.filter((e) => e.quantity > 0).length

  return (
    <article
      id={`pedido-${order.id}`}
      className={`${cardClass} overflow-hidden transition-shadow duration-700 ${focused ? 'ring-2 ring-orange-base' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-gray-900">{order.branch.name}</p>
          <p className="text-xs text-gray-500">
            Pedido {orderCode(order)} · {formatDateTime(order.createdAt)} · {order.requestedBy.name}
          </p>
        </div>
        <Menu
          actions={[
            { label: 'Imprimir', icon: PrinterIcon, onClick: onPrint },
            { label: 'Editar pedido', icon: EditIcon, onClick: onEdit, disabled: order.status !== 'RECEBIDO' },
            { label: 'Cancelar pedido', icon: BanIcon, onClick: onCancel, danger: true, disabled: order.status !== 'RECEBIDO' },
          ]}
        />
      </div>

      <div className="p-4">
        <OrderTracker order={order} events={events} />

        {(order.adminNotes || order.notes) && (
          <div className="mt-4 space-y-2">
            {order.adminNotes && (
              <p className="flex gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <NoteIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Central:</strong> {order.adminNotes}
                </span>
              </p>
            )}
            {order.notes && (
              <p className="flex gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <NoteIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Sua observação:</strong> {order.notes}
                </span>
              </p>
            )}
          </div>
        )}

        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-800">
            {itemCount} {itemCount === 1 ? 'item' : 'itens'} no pedido
            <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-1">
            <OrderItemsList order={order} />
          </div>
        </details>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="mt-3 text-xs font-bold text-gray-500 underline-offset-2 hover:underline"
        >
          {showHistory ? 'Esconder histórico' : 'Ver histórico do pedido'}
        </button>
        {showHistory && (
          <div className="mt-3">
            <OrderTimeline events={events} />
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {order.status === 'ENVIADO' && (
            <button type="button" onClick={onReceive} className={`${btnTeal} flex-1 py-3`}>
              <PackageCheckIcon className="h-5 w-5" /> Confirmar recebimento
            </button>
          )}
          {order.status === 'RECEBIDO' && (
            <>
              <button type="button" onClick={onAddItems} className={`${btnPrimary} flex-1`}>
                <PlusIcon className="h-4 w-4" /> Adicionar itens
              </button>
              <button type="button" onClick={onEdit} className={`${btnSecondary} flex-1`}>
                <EditIcon className="h-4 w-4" /> Editar quantidades
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

/** Filial: acompanhamento de cada pedido em andamento, no estilo "seu pedido está a caminho". */
export default function Acompanhar() {
  const { user } = useAuth()
  const { activeOrders, loadingOrders, updateOrder } = useOrders()
  const location = useLocation()
  const navigate = useNavigate()
  const focusOrderId = useNavigationFocus<string>('focusOrderId')
  const { printingOrder, printOrder } = usePrintOrder()
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [editTarget, setEditTarget] = useState<Order | null>(null)

  // vindo do lembrete "seu pedido chegou?", já abre a confirmação
  useEffect(() => {
    const state = location.state as { openReceipt?: boolean; focusOrderId?: string } | null
    if (!state?.openReceipt || !state.focusOrderId) return
    const target = activeOrders.find((o) => o.id === state.focusOrderId && o.status === 'ENVIADO')
    if (target) setReceiptOrder(target)
    // só ao chegar na página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, loadingOrders])

  useEffect(() => {
    if (!focusOrderId || loadingOrders) return
    document.getElementById(`pedido-${focusOrderId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusOrderId, loadingOrders])

  if (loadingOrders) return <SkeletonCards count={2} className="h-64" />

  return (
    <div>
      <div className="print:hidden">
        <h1 className="mb-1 text-2xl font-extrabold text-gray-900">Acompanhar pedidos</h1>
        <p className="mb-5 text-sm text-gray-500">Cada etapa aparece aqui assim que a central avança.</p>

        {activeOrders.length === 0 ? (
          <div className={cardClass}>
            <EmptyState
              icon={TruckIcon}
              title="Nenhum pedido em andamento"
              description="Quando você fizer um pedido, o andamento aparece aqui."
              action={
                <button type="button" onClick={() => navigate('/pedidos')} className={btnPrimary}>
                  <BagIcon className="h-4 w-4" /> Fazer pedido
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeOrders.map((order) => (
              <TrackerCard
                key={order.id}
                order={order}
                focused={focusOrderId === order.id}
                onReceive={() => setReceiptOrder(order)}
                onCancel={() => setCancelTarget(order)}
                onEdit={() => setEditTarget(order)}
                onPrint={() => printOrder(order)}
                onAddItems={() => navigate('/pedidos')}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden print:block">{printingOrder && <OrderPrintSheet order={printingOrder} />}</div>

      <ReceiptSheet
        order={receiptOrder}
        onClose={() => setReceiptOrder(null)}
        onConfirmed={(updated) => {
          updateOrder(updated)
          setReceiptOrder(null)
        }}
      />
      <CancelOrderSheet
        order={cancelTarget}
        asAdmin={false}
        onClose={() => setCancelTarget(null)}
        onCancelled={(updated) => {
          updateOrder(updated)
          setCancelTarget(null)
        }}
      />
      <OrderFulfillmentModal
        order={editTarget}
        mode="owner"
        branches={user?.branches ?? []}
        onClose={() => setEditTarget(null)}
        onSaved={(updated) => {
          updateOrder(updated)
          setEditTarget(null)
        }}
      />
    </div>
  )
}
