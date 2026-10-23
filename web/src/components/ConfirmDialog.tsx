import { useEffect, type ReactNode } from 'react'
import { AlertIcon } from './icons'
import { btnDanger, btnPrimary, btnSecondary } from '../lib/ui'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-60 flex animate-fade-in items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] print:hidden sm:items-center sm:p-4"
      onClick={() => !loading && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-scale-in rounded-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-float sm:pb-6"
      >
        <span
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
            danger ? 'bg-red-base/10 text-red-base' : 'bg-orange-base/10 text-orange-base'
          }`}
        >
          <AlertIcon className="h-6 w-6" />
        </span>
        <h2 id="confirm-dialog-title" className="text-lg font-extrabold text-gray-900">
          {title}
        </h2>
        <div className="mt-1.5 text-sm text-gray-600">{message}</div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className={btnSecondary}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={danger ? btnDanger : btnPrimary}>
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
