import { useState } from 'react'
import { api, ApiError, assetUrl } from '../../lib/api'
import type { Order } from '../../types'
import { useItems } from '../../context/ItemsContext'
import { useToast } from '../../context/ToastContext'
import { useOrderEvents } from '../../hooks/useOrderEvents'
import { formatDateTime, orderCode } from '../../lib/format'
import { OPEN_STATUSES, RECEIPT_ISSUE_LABELS } from '../../lib/orderStatus'
import { btnDanger, btnPrimary, btnSecondary, sectionTitle } from '../../lib/ui'
import Sheet from '../ui/Sheet'
import { StatusPill } from '../ui/StatusPill'
import OrderTracker from './OrderTracker'
import OrderTimeline from './OrderTimeline'
import ItemSearchSelect from '../ItemSearchSelect'
import PhotoLightbox from '../PhotoLightbox'
import { BanIcon, EditIcon, NoteIcon, PrinterIcon } from '../icons'

interface OrderDetailSheetProps {
  order: Order | null
  onClose: () => void
  onUpdated: (order: Order) => void
  onAdvance: (order: Order) => void
  onEdit: (order: Order) => void
  onCancel: (order: Order) => void
  onPrint: (order: Order) => void
  advanceLabel: (order: Order) => string | null
}

/** Central: tudo sobre um pedido num painel ao lado do quadro. */
export default function OrderDetailSheet({
  order,
  onClose,
  onUpdated,
  onAdvance,
  onEdit,
  onCancel,
  onPrint,
  advanceLabel,
}: OrderDetailSheetProps) {
  const { items: catalog } = useItems()
  const toast = useToast()
  const events = useOrderEvents(order)
  const [convertingExtra, setConvertingExtra] = useState<string | null>(null)
  const [showPhoto, setShowPhoto] = useState(false)

  if (!order) return null
  const open = OPEN_STATUSES.includes(order.status)
  const stockById = new Map(catalog.map((item) => [item.id, item.stockQuantity]))
  const nextLabel = advanceLabel(order)

  async function convert(extraId: string, itemId: string) {
    if (!order || !itemId) return
    try {
      const updated = await api.post<Order>(`/orders/${order.id}/extras/${extraId}/convert`, { itemId })
      onUpdated(updated)
      setConvertingExtra(null)
      toast.success('Item extra trocado pelo produto do catálogo')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível trocar o item')
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      variant="drawer"
      size="lg"
      title={`${order.branch.name} · ${orderCode(order)}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill status={order.status} /> Feito em {formatDateTime(order.createdAt)} por {order.requestedBy.name}
        </span>
      }
      footer={
        <div className="flex flex-wrap gap-2">
          {nextLabel && (
            <button type="button" onClick={() => onAdvance(order)} className={`${btnPrimary} flex-1`}>
              {nextLabel}
            </button>
          )}
          {order.status !== 'CANCELADO' && (
            <button type="button" onClick={() => onEdit(order)} className={btnSecondary}>
              <EditIcon className="h-4 w-4" /> Ajustar itens
            </button>
          )}
          <button type="button" onClick={() => onPrint(order)} className={btnSecondary} aria-label="Imprimir">
            <PrinterIcon className="h-4 w-4" />
          </button>
          {open && (
            <button type="button" onClick={() => onCancel(order)} className={btnDanger} aria-label="Cancelar pedido">
              <BanIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-gray-50 p-4">
          <OrderTracker order={order} events={events} />
        </div>

        {(order.notes || order.adminNotes) && (
          <div className="space-y-2">
            {order.notes && (
              <p className="flex gap-2 rounded-xl bg-orange-base/10 px-3 py-2 text-sm text-gray-900">
                <NoteIcon className="mt-0.5 h-4 w-4 shrink-0 text-orange-base" />
                <span>
                  <strong>Filial:</strong> {order.notes}
                </span>
              </p>
            )}
            {order.adminNotes && (
              <p className="flex gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <NoteIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Central:</strong> {order.adminNotes}
                </span>
              </p>
            )}
          </div>
        )}

        <div>
          <p className={`${sectionTitle} mb-2`}>Itens</p>
          <div className="overflow-hidden rounded-2xl ring-1 ring-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500">
                <tr>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-2 py-2 text-center">Pedido</th>
                  <th className="px-2 py-2 text-center">Vai</th>
                  {open && <th className="px-2 py-2 text-center">Estoque</th>}
                  {order.status === 'ENTREGUE' && <th className="px-2 py-2 text-center">Chegou</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((oi) => {
                  const stock = stockById.get(oi.itemId) ?? oi.item.stockQuantity
                  return (
                    <tr key={oi.id}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-900">{oi.item.name}</p>
                        <p className="text-xs text-gray-500">
                          {oi.item.packaging.name}
                          {oi.adjustReason && <span className="text-amber-700"> · {oi.adjustReason}</span>}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-center text-gray-500 tabular-nums">{oi.requestedQuantity || '—'}</td>
                      <td className={`px-2 py-2 text-center font-bold tabular-nums ${oi.quantity !== oi.requestedQuantity ? 'text-amber-700' : 'text-gray-900'}`}>
                        {oi.quantity}
                      </td>
                      {open && (
                        <td className={`px-2 py-2 text-center tabular-nums ${stock < oi.quantity ? 'font-bold text-red-600' : 'text-gray-600'}`}>{stock}</td>
                      )}
                      {order.status === 'ENTREGUE' && (
                        <td className={`px-2 py-2 text-center tabular-nums ${oi.receiptIssue ? 'font-bold text-red-600' : 'text-gray-600'}`}>
                          {oi.receivedQuantity ?? '—'}
                          {oi.receiptIssue && <span className="block text-[10px]">{RECEIPT_ISSUE_LABELS[oi.receiptIssue]}</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
                {order.extraItems.map((extra) => (
                  <tr key={extra.id} className="bg-amber-50/40">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-900">{extra.name}</p>
                      <p className="text-xs text-amber-700">item extra{extra.adjustReason && ` · ${extra.adjustReason}`}</p>
                      {open &&
                        (convertingExtra === extra.id ? (
                          <div className="mt-2">
                            <ItemSearchSelect
                              items={catalog.filter((item) => item.active)}
                              value=""
                              onChange={(itemId) => convert(extra.id, itemId)}
                              placeholder="Qual produto do catálogo é esse?"
                            />
                            <p className="mt-1 text-[11px] text-gray-500">Não está no catálogo? Cadastre em Cadastros → Produtos.</p>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setConvertingExtra(extra.id)} className="mt-1 text-xs font-bold text-orange-base">
                            Trocar por produto do catálogo
                          </button>
                        ))}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500 tabular-nums">{extra.requestedQuantity || '—'}</td>
                    <td className="px-2 py-2 text-center font-bold tabular-nums">{extra.quantity}</td>
                    {open && <td className="px-2 py-2 text-center text-gray-400">—</td>}
                    {order.status === 'ENTREGUE' && (
                      <td className={`px-2 py-2 text-center tabular-nums ${extra.receiptIssue ? 'font-bold text-red-600' : 'text-gray-600'}`}>
                        {extra.receivedQuantity ?? '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {order.status === 'ENTREGUE' && (order.receiptNotes || order.receiptPhotoPath) && (
          <div className="rounded-2xl bg-red-50 p-3">
            <p className="text-sm font-bold text-red-900">Recebimento com observação</p>
            {order.receiptNotes && <p className="mt-1 text-sm text-red-900">{order.receiptNotes}</p>}
            {order.receiptPhotoPath && (
              <button type="button" onClick={() => setShowPhoto(true)} className="mt-2 block overflow-hidden rounded-xl">
                <img src={assetUrl(order.receiptPhotoPath)} alt="Foto do recebimento" className="h-24 w-24 object-cover" />
              </button>
            )}
          </div>
        )}

        {order.status === 'CANCELADO' && (
          <p className="rounded-2xl bg-gray-100 p-3 text-sm text-gray-700">
            Cancelado {order.cancelledBy ? `por ${order.cancelledBy.name}` : ''} em {order.cancelledAt ? formatDateTime(order.cancelledAt) : '—'}
            {order.cancelReason && `: ${order.cancelReason}`}
          </p>
        )}

        <div>
          <p className={`${sectionTitle} mb-3`}>Histórico</p>
          <OrderTimeline events={events} />
        </div>
      </div>

      <PhotoLightbox
        src={showPhoto && order.receiptPhotoPath ? assetUrl(order.receiptPhotoPath) : null}
        alt="Foto do recebimento"
        onClose={() => setShowPhoto(false)}
      />
    </Sheet>
  )
}
