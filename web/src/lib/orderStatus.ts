import type { OrderStatus } from '../types'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDENTE: 'Pendente',
  EM_SEPARACAO: 'Em separação',
  AGUARDANDO_ENVIO: 'Aguardando envio',
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
}

export const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDENTE: 'bg-gray-100 text-gray-700',
  EM_SEPARACAO: 'bg-amber-100 text-amber-800',
  AGUARDANDO_ENVIO: 'bg-blue-100 text-blue-800',
  ENVIADO: 'bg-novamix-orange/15 text-novamix-orange-dark',
  ENTREGUE: 'bg-novamix-teal/15 text-novamix-teal-dark',
}
