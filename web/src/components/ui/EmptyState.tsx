import type { ComponentType, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
}

export default function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-12'}`}>
      <span
        className={`mb-3 flex items-center justify-center rounded-full bg-orange-base/10 text-orange-base ${
          compact ? 'h-12 w-12' : 'h-16 w-16'
        }`}
      >
        <Icon className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
      </span>
      <p className="font-bold text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
