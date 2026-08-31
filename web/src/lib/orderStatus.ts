import type { OrderStatus } from '../types'

export const STATUS_ORDER: OrderStatus[] = ['RECEBIDO', 'EM_ANDAMENTO', 'ENVIADO', 'ENTREGUE']

export const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEBIDO: 'Recebido',
  EM_ANDAMENTO: 'Em andamento',
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
}

export const STATUS_STYLES: Record<OrderStatus, string> = {
  RECEBIDO: 'bg-gray-100 text-gray-700',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-800',
  ENVIADO: 'bg-novamix-orange/15 text-novamix-orange-dark',
  ENTREGUE: 'bg-novamix-teal/15 text-novamix-teal-dark',
}
