import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface PhotoLightboxProps {
  src: string | null
  alt: string
  onClose: () => void
  actions?: ReactNode
}

export default function PhotoLightbox({ src, alt, onClose, actions }: PhotoLightboxProps) {
  useEffect(() => {
    if (!src) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col items-center justify-center gap-4 bg-black/85 p-4 print:hidden"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Fechar"
        className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600"
      >
        <CloseIcon className="h-5 w-5" />
      </button>

      <img
        src={src}
        alt={alt}
        className="max-h-[75dvh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <p className="max-w-full truncate px-4 text-center text-sm font-medium text-white">{alt}</p>

      {actions && (
        <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  )
}
