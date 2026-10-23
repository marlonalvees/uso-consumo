import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from '../icons'

let openSheets = 0

// trava a rolagem da página atrás da folha (conta folhas abertas umas sobre as outras)
function lockScroll() {
  openSheets += 1
  if (openSheets === 1) {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  }
}

function unlockScroll() {
  openSheets = Math.max(0, openSheets - 1)
  if (openSheets === 0) {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  }
}

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** no computador: janela no centro ou painel na direita */
  variant?: 'dialog' | 'drawer'
  size?: 'sm' | 'md' | 'lg'
  /** tocar fora fecha; desligado em formulários pra não perder o que foi digitado */
  dismissible?: boolean
}

const DIALOG_WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
const DRAWER_WIDTH = { sm: 'lg:max-w-md', md: 'lg:max-w-xl', lg: 'lg:max-w-2xl' }

/** No celular sobe de baixo, com a alça de arrastar, como as folhas do app do iFood. */
export default function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = 'dialog',
  size = 'md',
  dismissible = true,
}: SheetProps) {
  useEffect(() => {
    if (!open) return
    lockScroll()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      unlockScroll()
    }
  }, [open, dismissible, onClose])

  if (!open) return null

  const drawer = variant === 'drawer'
  const layout = drawer
    ? `lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:max-h-none lg:w-full ${DRAWER_WIDTH[size]} lg:rounded-none lg:rounded-l-3xl lg:animate-slide-in-right`
    : `sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full ${DIALOG_WIDTH[size]} sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:animate-scale-in`

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div
        className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]"
        onClick={() => dismissible && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] animate-sheet-up flex-col rounded-t-3xl bg-white shadow-float ${layout}`}
      >
        <div className={`flex justify-center pt-2.5 ${drawer ? 'lg:hidden' : 'sm:hidden'}`}>
          <span className="h-1.5 w-10 rounded-full bg-gray-300" />
        </div>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 sm:pt-5">
            <div className="min-w-0">
              {title && <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>}
              {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="press -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && (
          <div className="border-t border-gray-100 bg-white px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
