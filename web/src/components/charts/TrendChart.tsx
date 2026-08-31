import { useRef, useState, type MouseEvent } from 'react'

export interface TrendPoint {
  label: string
  value: number
}

interface TrendChartProps {
  points: TrendPoint[]
  color: string
  formatValue?: (value: number) => string
  emptyLabel?: string
}

const VIEW_W = 600
const VIEW_H = 200
const PAD = { top: 12, right: 12, bottom: 24, left: 12 }

function pickTickIndices(n: number, maxTicks = 6): number[] {
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i)
  const step = (n - 1) / (maxTicks - 1)
  const indices = Array.from({ length: maxTicks }, (_, i) => Math.round(i * step))
  return [...new Set(indices)]
}

export default function TrendChart({
  points,
  color,
  formatValue = (value) => String(value),
  emptyLabel = 'Sem dados no período.',
}: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel}</p>
  }

  const innerW = VIEW_W - PAD.left - PAD.right
  const innerH = VIEW_H - PAD.top - PAD.bottom
  const maxValue = Math.max(1, ...points.map((p) => p.value))
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0
  const x = (i: number) => PAD.left + (points.length > 1 ? i * xStep : innerW / 2)
  const y = (v: number) => PAD.top + innerH - (v / maxValue) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ')
  const areaPath =
    points.length > 1
      ? `${linePath} L${x(points.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`
      : ''

  const tickIndices = pickTickIndices(points.length)

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg || points.length < 2) return
    const rect = svg.getBoundingClientRect()
    const localX = ((e.clientX - rect.left) / rect.width) * VIEW_W
    const index = Math.round((localX - PAD.left) / xStep)
    setHoverIndex(Math.min(Math.max(index, 0), points.length - 1))
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null
  const tooltipLeft = hoverIndex !== null ? (x(hoverIndex) / VIEW_W) * 100 : 0
  const tooltipAlignEnd = tooltipLeft > 70

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full touch-none"
        role="img"
        aria-label="Pedidos ao longo do tempo"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <line
          x1={PAD.left}
          y1={PAD.top + innerH}
          x2={VIEW_W - PAD.right}
          y2={PAD.top + innerH}
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {areaPath && <path d={areaPath} fill={color} opacity={0.1} stroke="none" />}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.length === 1 && (
          <circle cx={x(0)} cy={y(points[0].value)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
        )}

        {hoverIndex !== null && (
          <>
            <line
              x1={x(hoverIndex)}
              y1={PAD.top}
              x2={x(hoverIndex)}
              y2={PAD.top + innerH}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <circle
              cx={x(hoverIndex)}
              cy={y(points[hoverIndex].value)}
              r={4}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}

        {tickIndices.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={VIEW_H - 6}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            className="fill-gray-400"
            fontSize={11}
          >
            {points[i].label}
          </text>
        ))}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg"
          style={
            tooltipAlignEnd
              ? { right: `${100 - tooltipLeft}%`, transform: 'translateX(50%)' }
              : { left: `${tooltipLeft}%`, transform: 'translateX(-50%)' }
          }
        >
          {hovered.label} · {formatValue(hovered.value)}
        </div>
      )}
    </div>
  )
}
