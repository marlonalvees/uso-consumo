export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

/** Lista de cartões "carregando", com o brilho passando. */
export function SkeletonCards({ count = 3, className = 'h-24' }: { count?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={`w-full rounded-2xl ${className}`} />
      ))}
    </div>
  )
}
