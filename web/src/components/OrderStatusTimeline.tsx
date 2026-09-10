import type { ComponentType } from 'react'
import type { OrderStatus } from '../types'
import { ClipboardIcon, PackageCheckIcon, PackageSearchIcon, TruckIcon } from './icons'

interface Step {
  label: string
  Icon: ComponentType<{ className?: string }>
}

const STEPS: Step[] = [
  { label: 'Pedido Criado', Icon: ClipboardIcon },
  { label: 'Em Separação', Icon: PackageSearchIcon },
  { label: 'Em Transporte', Icon: TruckIcon },
  { label: 'Pedido Entregue', Icon: PackageCheckIcon },
]

function stepIndexForStatus(status: OrderStatus): number {
  switch (status) {
    case 'RECEBIDO':
      return 0
    case 'EM_ANDAMENTO':
      return 1
    case 'ENVIADO':
      return 2
    case 'ENTREGUE':
      return 3
    default:
      return 0
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface OrderStatusTimelineProps {
  status: OrderStatus
  createdAt: string
  deliveredAt: string | null
}

export default function OrderStatusTimeline({ status, createdAt, deliveredAt }: OrderStatusTimelineProps) {
  const currentIndex = stepIndexForStatus(status)
  const dates: (string | null)[] = [createdAt, null, null, deliveredAt]

  return (
    <div className="flex items-start">
      {STEPS.map((step, index) => {
        const done = index <= currentIndex
        const isCurrent = index === currentIndex
        return (
          <div key={step.label} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  done
                    ? 'border-novamix-teal bg-novamix-teal text-white'
                    : 'border-gray-200 bg-white text-gray-300'
                } ${isCurrent ? 'ring-2 ring-novamix-teal/30' : ''}`}
              >
                <step.Icon className="h-4 w-4" />
              </div>
              <p className={`mt-2 max-w-[6.5rem] text-center text-xs font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </p>
              {dates[index] && (
                <p className="text-center text-[11px] text-gray-400">{formatDate(dates[index] as string)}</p>
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div className={`mt-4 h-0.5 flex-1 ${index < currentIndex ? 'bg-novamix-teal' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
