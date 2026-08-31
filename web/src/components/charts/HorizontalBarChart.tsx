import { useState } from 'react'

export interface BarChartRow {
  label: string
  value: number
}

interface HorizontalBarChartProps {
  rows: BarChartRow[]
  color: string
  formatValue?: (value: number) => string
  emptyLabel?: string
}

export default function HorizontalBarChart({
  rows,
  color,
  formatValue = (value) => String(value),
  emptyLabel = 'Sem dados.',
}: HorizontalBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel}</p>
  }

  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <ul className="space-y-3">
      {rows.map((row, index) => {
        const pct = (row.value / max) * 100
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-gray-700">{row.label}</span>
              <span className="shrink-0 font-medium text-gray-900 tabular-nums">
                {formatValue(row.value)}
              </span>
            </div>
            <div
              className="relative h-2.5 rounded-full bg-gray-100"
              tabIndex={0}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
              />
              {hovered === index && (
                <div
                  className="pointer-events-none absolute -top-8 z-10 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg"
                  style={{ left: `${Math.min(Math.max(pct, 6), 94)}%` }}
                >
                  {formatValue(row.value)}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
