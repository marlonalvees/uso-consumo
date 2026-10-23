import type { OrderStatus } from '../../types'
import { AGE_STYLES, ageLevel, STATUS_DOTS, STATUS_LABELS, STATUS_STYLES } from '../../lib/orderStatus'
import { timeAgo } from '../../lib/format'
import { ClockIcon } from '../icons'

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  )
}

/** Há quanto tempo o pedido está na etapa, de verde a vermelho. */
export function AgeChip({ status, since, now }: { status: OrderStatus; since: string; now: number }) {
  const level = ageLevel(status, since, now)
  return (
    <span
      title={new Date(since).toLocaleString('pt-BR')}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${AGE_STYLES[level]}`}
    >
      <ClockIcon className="h-3 w-3" />
      {timeAgo(since, now)}
    </span>
  )
}
