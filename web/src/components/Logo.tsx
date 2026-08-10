export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex font-bold tracking-tight ${className}`}>
      <span className="text-novamix-orange">n</span>
      <span className="text-novamix-teal">m</span>
    </span>
  )
}
