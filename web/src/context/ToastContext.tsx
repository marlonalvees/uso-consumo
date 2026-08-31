import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckIcon, CloseIcon, AlertIcon } from '../components/icons'

type ToastType = 'success' | 'error'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DURATION: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
}

const STYLES: Record<ToastType, { wrapper: string; icon: string }> = {
  success: {
    wrapper: 'border-novamix-teal/20 bg-white text-gray-900',
    icon: 'bg-novamix-teal/15 text-novamix-teal',
  },
  error: {
    wrapper: 'border-red-base/20 bg-white text-gray-900',
    icon: 'bg-red-base/10 text-red-base',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, type, message }])
      window.setTimeout(() => dismiss(id), DURATION[type])
    },
    [dismiss],
  )

  const success = useCallback((message: string) => push('success', message), [push])
  const error = useCallback((message: string) => push('error', message), [push])
  const value = useMemo(() => ({ success, error }), [success, error])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-center gap-2 print:hidden sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((toast) => {
          const style = STYLES[toast.type]
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg ${style.wrapper}`}
            >
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.icon}`}>
                {toast.type === 'success' ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <AlertIcon className="h-3.5 w-3.5" />
                )}
              </span>
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fechar"
                className="shrink-0 rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <CloseIcon className="h-3.5 w-3.5" />
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
