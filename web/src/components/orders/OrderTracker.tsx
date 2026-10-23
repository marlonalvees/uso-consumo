import type { ComponentType } from 'react'
import type { Order, OrderEvent, OrderStatus } from '../../types'
import { formatDateTime } from '../../lib/format'
import { BanIcon, ClipboardIcon, PackageCheckIcon, PackageSearchIcon, TruckIcon } from '../icons'

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'RECEBIDO', label: 'Recebido' },
  { status: 'EM_ANDAMENTO', label: 'Separação' },
  { status: 'ENVIADO', label: 'A caminho' },
  { status: 'ENTREGUE', label: 'Entregue' },
]

const HEADLINES: Record<OrderStatus, { title: string; text: string; icon: ComponentType<{ className?: string }>; tone: string; bar: string }> = {
  RECEBIDO: {
    title: 'Pedido recebido',
    text: 'A central recebeu o pedido e vai começar a separar.',
    icon: ClipboardIcon,
    tone: 'bg-red-base text-white',
    bar: 'bg-red-base',
  },
  EM_ANDAMENTO: {
    title: 'Em separação',
    text: 'A central está separando os itens do pedido.',
    icon: PackageSearchIcon,
    tone: 'bg-amber-400 text-amber-950',
    bar: 'bg-amber-400',
  },
  ENVIADO: {
    title: 'A caminho',
    text: 'O pedido saiu da central. Confirme o recebimento quando chegar.',
    icon: TruckIcon,
    tone: 'bg-blue-600 text-white',
    bar: 'bg-blue-600',
  },
  ENTREGUE: {
    title: 'Entregue',
    text: 'Recebimento confirmado pela filial.',
    icon: PackageCheckIcon,
    tone: 'bg-emerald-500 text-white',
    bar: 'bg-emerald-500',
  },
  CANCELADO: {
    title: 'Pedido cancelado',
    text: '',
    icon: BanIcon,
    tone: 'bg-gray-400 text-white',
    bar: 'bg-gray-300',
  },
}

/** Quando o pedido entrou em cada etapa: pelo histórico, ou pelas datas do próprio pedido. */
function stepDates(order: Order, events: OrderEvent[] | null): Partial<Record<OrderStatus, string>> {
  const dates: Partial<Record<OrderStatus, string>> = { RECEBIDO: order.createdAt }
  if (order.sentAt) dates.ENVIADO = order.sentAt
  if (order.deliveredAt) dates.ENTREGUE = order.deliveredAt
  for (const event of events ?? []) {
    // a última entrada em cada etapa vale (separação desfeita e refeita)
    if (event.type === 'STATUS' && event.toStatus && event.toStatus !== 'RECEBIDO') dates[event.toStatus] = event.createdAt
  }
  return dates
}

/** Acompanhamento do pedido no estilo do app do iFood: ícone pulsando e barra por etapa. */
export default function OrderTracker({ order, events }: { order: Order; events: OrderEvent[] | null }) {
  const headline = HEADLINES[order.status]
  const currentIndex = STEPS.findIndex((step) => step.status === order.status)
  const dates = stepDates(order, events)
  const cancelled = order.status === 'CANCELADO'
  const live = !cancelled && order.status !== 'ENTREGUE'

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${headline.tone} ${
            live ? 'motion-safe:animate-pulse-ring' : ''
          }`}
        >
          <headline.icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-extrabold text-gray-900">{headline.title}</p>
          <p className="text-sm text-gray-500">
            {cancelled ? `Motivo: ${order.cancelReason ?? 'não informado'}` : headline.text}
          </p>
        </div>
      </div>

      {!cancelled && (
        <div className="mt-4">
          <div className="flex gap-1.5">
            {STEPS.map((step, index) => {
              const done = index < currentIndex || order.status === 'ENTREGUE'
              const current = index === currentIndex && live
              return (
                <div key={step.status} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                  {(done || current) && (
                    <div className={`h-full w-full ${headline.bar} ${current ? 'progress-stripes' : ''}`} />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {STEPS.map((step, index) => (
              <div key={step.status}>
                <p className={`text-[11px] font-bold ${index <= currentIndex ? 'text-gray-800' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {dates[step.status] && index <= currentIndex && (
                  <p className="text-[10px] text-gray-500 tabular-nums">{formatDateTime(dates[step.status]!)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
