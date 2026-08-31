import type { JSX } from 'react'
import type { OrderStatus } from '../types'

interface Step {
  label: string
  icon: JSX.Element
}

const ICON_PROPS = {
  className: 'h-5 w-5',
  fill: 'none',
  viewBox: '0 0 24 24',
  strokeWidth: 1.8,
  stroke: 'currentColor',
}

const STEPS: Step[] = [
  {
    label: 'Pedido Criado',
    icon: (
      <svg {...ICON_PROPS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M9 8h1M5 21h14a1 1 0 0 0 1-1V6.828a1 1 0 0 0-.293-.707l-2.828-2.828A1 1 0 0 0 16.172 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1Z" />
      </svg>
    ),
  },
  {
    label: 'Em Separação',
    icon: (
      <svg {...ICON_PROPS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 8 8.25 4.5L20.25 8M3.75 8v8l8.25 4.5m8.25-12.5v8l-8.25 4.5m0-9V21m8.25-13-8.25-4.5L3.75 8" />
      </svg>
    ),
  },
  {
    label: 'Em Transporte',
    icon: (
      <svg {...ICON_PROPS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v10H3zm11 3h4l3 3v4h-7zM6.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </svg>
    ),
  },
  {
    label: 'Pedido Entregue',
    icon: (
      <svg {...ICON_PROPS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 11 9-7 9 7M5 10v10h14V10M9.5 20v-6h5v6" />
      </svg>
    ),
  },
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
                {step.icon}
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
