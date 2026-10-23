import type { ComponentType } from 'react'

export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
  icon?: ComponentType<{ className?: string }>
  /** bolinha colorida antes do rótulo (cor da etapa) */
  dot?: string
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /** "pill" = botões arredondados; "underline" = abas de navegação da página */
  variant?: 'pill' | 'underline'
  className?: string
}

export default function Tabs<T extends string>({ tabs, value, onChange, variant = 'pill', className = '' }: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div role="tablist" className={`scrollbar-none flex gap-6 overflow-x-auto border-b border-gray-200 ${className}`}>
        {tabs.map((tab) => {
          const active = tab.value === value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={`relative flex shrink-0 items-center gap-2 pb-3 text-sm font-bold transition-colors ${
                active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-orange-base px-1.5 py-0.5 text-[11px] leading-none font-bold text-white">
                  {tab.count}
                </span>
              )}
              {active && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-orange-base" />}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="tablist" className={`scrollbar-none flex gap-2 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`press flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.dot && <span className={`h-2 w-2 rounded-full ${tab.dot}`} />}
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
