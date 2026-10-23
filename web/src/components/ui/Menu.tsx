import { useEffect, useRef, useState, type ComponentType } from 'react'
import { MoreIcon } from '../icons'

export interface MenuAction {
  label: string
  icon?: ComponentType<{ className?: string }>
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

/** Menu "⋯" com as ações secundárias de um cartão. */
export default function Menu({ actions, label = 'Mais ações' }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const visible = actions.filter((action) => !action.disabled)
  if (visible.length === 0) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label={label}
        aria-expanded={open}
        className="press flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
      >
        <MoreIcon className="h-5 w-5" />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 bottom-full z-30 mb-2 min-w-48 animate-scale-in overflow-hidden rounded-2xl bg-white py-1.5 shadow-float ring-1 ring-black/5"
        >
          {visible.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  action.onClick()
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50 ${
                  action.danger ? 'text-red-600' : 'text-gray-800'
                }`}
              >
                {action.icon && <action.icon className="h-4 w-4 shrink-0" />}
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
