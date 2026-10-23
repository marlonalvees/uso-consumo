import type { OrderStatus, ReceiptIssue } from '../types'

// as quatro etapas do fluxo; Cancelado fica fora da linha do tempo
export const STATUS_ORDER: OrderStatus[] = ['RECEBIDO', 'EM_ANDAMENTO', 'ENVIADO', 'ENTREGUE']
export const ALL_STATUSES: OrderStatus[] = [...STATUS_ORDER, 'CANCELADO']
/** a filial ainda acompanha: a central não terminou ou a filial não confirmou */
export const ACTIVE_STATUSES: OrderStatus[] = ['RECEBIDO', 'EM_ANDAMENTO', 'ENVIADO']
/** a central ainda não enviou: a filial adiciona itens a ele em vez de abrir outro */
export const OPEN_STATUSES: OrderStatus[] = ['RECEBIDO', 'EM_ANDAMENTO']

export const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEBIDO: 'Recebido',
  EM_ANDAMENTO: 'Em separação',
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

// mesmas cores das barras do topo: vermelho, âmbar, azul, verde
export const STATUS_STYLES: Record<OrderStatus, string> = {
  RECEBIDO: 'bg-red-50 text-red-700 ring-red-200',
  EM_ANDAMENTO: 'bg-amber-50 text-amber-800 ring-amber-200',
  ENVIADO: 'bg-blue-50 text-blue-700 ring-blue-200',
  ENTREGUE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELADO: 'bg-gray-100 text-gray-600 ring-gray-200',
}

export const STATUS_DOTS: Record<OrderStatus, string> = {
  RECEBIDO: 'bg-red-base',
  EM_ANDAMENTO: 'bg-amber-400',
  ENVIADO: 'bg-blue-600',
  ENTREGUE: 'bg-emerald-500',
  CANCELADO: 'bg-gray-400',
}

export const STATUS_HEX: Record<OrderStatus, string> = {
  RECEBIDO: '#df0406',
  EM_ANDAMENTO: '#f59e0b',
  ENVIADO: '#2563eb',
  ENTREGUE: '#10b981',
  CANCELADO: '#9ca3af',
}

export const RECEIPT_ISSUE_LABELS: Record<ReceiptIssue, string> = {
  FALTOU: 'Faltou',
  AVARIADO: 'Avariado',
}

/** Há quanto tempo o pedido está parado na etapa: [vira âmbar, vira vermelho] em horas. */
const AGE_THRESHOLDS_HOURS: Partial<Record<OrderStatus, [number, number]>> = {
  RECEBIDO: [4, 24],
  EM_ANDAMENTO: [24, 48],
  ENVIADO: [72, 168],
}

export type AgeLevel = 'ok' | 'warn' | 'late'

export function ageLevel(status: OrderStatus, since: string, now = Date.now()): AgeLevel {
  const thresholds = AGE_THRESHOLDS_HOURS[status]
  if (!thresholds) return 'ok'
  const hours = (now - new Date(since).getTime()) / 3_600_000
  if (hours >= thresholds[1]) return 'late'
  if (hours >= thresholds[0]) return 'warn'
  return 'ok'
}

export const AGE_STYLES: Record<AgeLevel, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  late: 'bg-red-50 text-red-700',
}
