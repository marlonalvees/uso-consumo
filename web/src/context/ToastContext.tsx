import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckIcon, CloseIcon, AlertIcon, InfoIcon } from '../components/icons'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  /** botão no aviso (ex.: "Desfazer") */
  action?: ToastAction
}

interface Toast {
  id: number
  type: ToastType
  message: string
  action?: ToastAction
}

interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DURATION: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  info: 5000,
}

const ICON_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-red-base text-white',
  info: 'bg-blue-600 text-white',
}

const ICONS = { success: CheckIcon, error: AlertIcon, info: InfoIcon }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, message: string, options?: ToastOptions) => {
      const id = nextId.current++
      setToasts((prev) => [...prev.slice(-2), { id, type, message, action: options?.action }])
      // com botão de desfazer, o aviso fica um pouco mais na tela
      window.setTimeout(() => dismiss(id), options?.action ? 7000 : DURATION[type])
    },
    [dismiss],
  )

  const success = useCallback((message: string, options?: ToastOptions) => push('success', message, options), [push])
  const error = useCallback((message: string, options?: ToastOptions) => push('error', message, options), [push])
  const info = useCallback((message: string, options?: ToastOptions) => push('info', message, options), [push])
  const value = useMemo(() => ({ success, error, info }), [success, error, info])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* no celular aparece embaixo, acima da barra de navegação; no computador, no canto de cima */}
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-70 flex flex-col items-center gap-2 print:hidden lg:inset-x-auto lg:top-4 lg:right-4 lg:bottom-auto lg:items-end">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type]
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-scale-in items-center gap-3 rounded-2xl bg-gray-900 p-3 pr-2 text-white shadow-float"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ICON_STYLES[toast.type]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="flex-1 text-sm font-semibold">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onClick()
                    dismiss(toast.id)
                  }}
                  className="press shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-extrabold text-orange-light transition-colors hover:bg-white/10"
                >
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fechar"
                className="shrink-0 rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
