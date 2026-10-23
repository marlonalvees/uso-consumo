import type { OrderEvent } from '../../types'
import { formatDateTime } from '../../lib/format'
import { STATUS_DOTS } from '../../lib/orderStatus'
import { Skeleton } from '../ui/Skeleton'

function describe(event: OrderEvent): string {
  const who = event.user?.name ? ` por ${event.user.name}` : ''
  switch (event.type) {
    case 'CRIADO':
      return `Pedido feito${who}`
    case 'EDITADO':
      return `Pedido editado${who}`
    case 'ITENS_AJUSTADOS':
      return `Itens ajustados${who}`
    case 'CANCELADO':
      return `Cancelado${who}`
    case 'RECEBIDO':
      return `Recebimento confirmado${who}`
    case 'STATUS':
      if (event.toStatus === 'EM_ANDAMENTO') return `Separação iniciada${who}`
      if (event.toStatus === 'ENVIADO') return `Pedido enviado${who}`
      if (event.toStatus === 'RECEBIDO') return `Separação desfeita${who}`
      return `Etapa alterada${who}`
  }
}

/** Histórico do pedido: quem fez cada coisa e quando. */
export default function OrderTimeline({ events }: { events: OrderEvent[] | null }) {
  if (events === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }
  if (events.length === 0) return <p className="text-sm text-gray-500">Sem histórico registrado.</p>

  return (
    <ol className="relative space-y-3 border-l-2 border-gray-100 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={`absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${
              event.toStatus ? STATUS_DOTS[event.toStatus] : 'bg-gray-400'
            }`}
          />
          <p className="text-sm font-semibold text-gray-800">{describe(event)}</p>
          {event.note && <p className="text-xs text-gray-600">{event.note}</p>}
          <p className="text-[11px] text-gray-500 tabular-nums">{formatDateTime(event.createdAt)}</p>
        </li>
      ))}
    </ol>
  )
}
