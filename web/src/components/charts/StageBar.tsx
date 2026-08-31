import { useState } from 'react'

export interface StageBarSegment {
  key: string
  label: string
  value: number
  color: string
}

interface StageBarProps {
  segments: StageBarSegment[]
  emptyLabel?: string
}

export default function StageBar({ segments, emptyLabel = 'Sem dados.' }: StageBarProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  if (total === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel}</p>
  }

  return (
    <div>
      <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-lg bg-gray-100">
        {segments.map((segment, index) => {
          if (segment.value === 0) return null
          const pct = (segment.value / total) * 100
          return (
            <div
              key={segment.key}
              tabIndex={0}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className="relative h-full transition-opacity first:rounded-l-lg last:rounded-r-lg"
              style={{
                width: `${pct}%`,
                backgroundColor: segment.color,
                opacity: hovered === null || hovered === index ? 1 : 0.45,
              }}
            >
              {hovered === index && (
                <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg">
                  {segment.label}: {segment.value}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-gray-600">{segment.label}</span>
            <span className="font-medium text-gray-900 tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
