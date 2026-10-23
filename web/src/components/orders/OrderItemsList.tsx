import { assetUrl } from '../../lib/api'
import { RECEIPT_ISSUE_LABELS } from '../../lib/orderStatus'
import type { Order } from '../../types'
import { ImageIcon } from '../icons'

interface Line {
  key: string
  name: string
  unit: string
  photoPath: string | null
  requested: number
  quantity: number
  adjustReason: string | null
  received: number | null
  issue: string | null
  extra: boolean
}

function linesOf(order: Order): Line[] {
  return [
    ...order.items.map((oi) => ({
      key: oi.id,
      name: oi.item.name,
      unit: oi.item.packaging.name,
      photoPath: oi.item.photoPath,
      requested: oi.requestedQuantity,
      quantity: oi.quantity,
      adjustReason: oi.adjustReason,
      received: oi.receivedQuantity,
      issue: oi.receiptIssue ? RECEIPT_ISSUE_LABELS[oi.receiptIssue] : null,
      extra: false,
    })),
    ...order.extraItems.map((extra) => ({
      key: extra.id,
      name: extra.name,
      unit: 'item extra',
      photoPath: null,
      requested: extra.requestedQuantity,
      quantity: extra.quantity,
      adjustReason: extra.adjustReason,
      received: extra.receivedQuantity,
      issue: extra.receiptIssue ? RECEIPT_ISSUE_LABELS[extra.receiptIssue] : null,
      extra: true,
    })),
  ]
}

/**
 * Itens do pedido mostrando o que mudou: quanto a filial pediu, quanto a central mandou
 * (e por quê) e quanto chegou.
 */
export default function OrderItemsList({ order, showPhotos = true }: { order: Order; showPhotos?: boolean }) {
  const lines = linesOf(order)

  return (
    <ul className="divide-y divide-gray-100">
      {lines.map((line) => {
        const changed = line.quantity !== line.requested
        const cutToZero = line.quantity === 0 && line.requested > 0
        return (
          <li key={line.key} className="flex items-start gap-3 py-2.5">
            {showPhotos && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-300">
                {line.photoPath ? (
                  <img src={assetUrl(line.photoPath)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${cutToZero ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{line.name}</p>
              <p className="text-xs text-gray-500">{line.unit}</p>
              {changed && (
                <p className="mt-0.5 text-xs font-semibold text-amber-700">
                  {line.requested > 0 ? `Pedido: ${line.requested} · vai ${line.quantity}` : 'Incluído pela central'}
                  {line.adjustReason && <span className="font-normal text-amber-700/90"> · {line.adjustReason}</span>}
                </p>
              )}
              {line.issue && line.received !== null && (
                <p className="mt-0.5 text-xs font-semibold text-red-600">
                  Chegou {line.received} de {line.quantity} · {line.issue}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-lg px-2 py-1 text-sm font-extrabold tabular-nums ${
                cutToZero ? 'bg-gray-100 text-gray-400' : 'bg-orange-base/10 text-orange-base'
              }`}
            >
              {line.quantity}×
            </span>
          </li>
        )
      })}
    </ul>
  )
}
