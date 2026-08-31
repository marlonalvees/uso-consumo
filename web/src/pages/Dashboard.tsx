import { useMemo, useState, type ReactNode } from 'react'
import { useOrders } from '../context/OrdersContext'
import { STATUS_LABELS, STATUS_ORDER } from '../lib/orderStatus'
import { DATE_PRESET_OPTIONS, matchesDatePreset, type DatePreset } from '../lib/dateFilter'
import { BoxIcon, ClockIcon, TruckIcon, CheckIcon, CoinIcon } from '../components/icons'
import StageBar from '../components/charts/StageBar'
import TrendChart from '../components/charts/TrendChart'
import HorizontalBarChart from '../components/charts/HorizontalBarChart'
import type { Order } from '../types'

const TEAL = '#0f6f63'
const ORANGE = '#f0862f'

const STAGE_COLORS: Record<(typeof STATUS_ORDER)[number], string> = {
  RECEBIDO: '#6bbdaf',
  EM_ANDAMENTO: '#50a295',
  ENVIADO: '#33887c',
  ENTREGUE: '#0f6f63',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, n: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + n)
  return copy
}

function startOfIsoWeek(date: Date) {
  const copy = startOfDay(date)
  const day = copy.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diffToMonday)
  return copy
}

function buildTrend(orders: Order[]) {
  if (orders.length === 0) return []

  const times = orders.map((o) => new Date(o.createdAt).getTime())
  const start = startOfDay(new Date(Math.min(...times)))
  const end = startOfDay(new Date(Math.max(...times)))
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const useWeekly = totalDays > 60

  if (useWeekly) {
    const startWeek = startOfIsoWeek(start)
    const endWeek = startOfIsoWeek(end)
    const totalWeeks = Math.round((endWeek.getTime() - startWeek.getTime()) / (7 * 86_400_000)) + 1
    const counts = new Array(totalWeeks).fill(0)
    for (const order of orders) {
      const week = startOfIsoWeek(new Date(order.createdAt))
      const idx = Math.round((week.getTime() - startWeek.getTime()) / (7 * 86_400_000))
      counts[idx] += 1
    }
    return counts.map((value, i) => ({
      label: addDays(startWeek, i * 7).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value,
    }))
  }

  const counts = new Array(totalDays).fill(0)
  for (const order of orders) {
    const day = startOfDay(new Date(order.createdAt))
    const idx = Math.round((day.getTime() - start.getTime()) / 86_400_000)
    counts[idx] += 1
  }
  return counts.map((value, i) => ({
    label: addDays(start, i).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value,
  }))
}

function StatCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  tone: 'teal' | 'orange'
  label: string
  value: string
  hint?: string
}) {
  const toneClasses =
    tone === 'teal' ? 'bg-novamix-teal/15 text-novamix-teal' : 'bg-novamix-orange/15 text-novamix-orange-dark'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
          {icon}
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">{title}</p>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const { orders, loadingOrders } = useOrders()

  const [datePreset, setDatePreset] = useState<DatePreset>('mes')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterBranch, setFilterBranch] = useState<number | ''>('')

  const branchOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const order of orders) map.set(order.branch.id, order.branch.name)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [orders])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterBranch && order.branch.id !== filterBranch) return false
      if (!matchesDatePreset(order.createdAt, datePreset, customStart, customEnd)) return false
      return true
    })
  }, [orders, filterBranch, datePreset, customStart, customEnd])

  if (loadingOrders) {
    return <p className="text-gray-500">Carregando dashboard...</p>
  }

  const totalPedidos = filteredOrders.length
  const entregues = filteredOrders.filter((o) => o.status === 'ENTREGUE').length
  const aguardandoConfirmacao = filteredOrders.filter((o) => o.status === 'ENVIADO').length
  const pendentes = totalPedidos - entregues

  const porStatus = STATUS_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    value: filteredOrders.filter((o) => o.status === status).length,
    color: STAGE_COLORS[status],
  }))

  const porFilialMap = new Map<string, number>()
  const consumoFilialMap = new Map<string, number>()
  for (const order of filteredOrders) {
    porFilialMap.set(order.branch.name, (porFilialMap.get(order.branch.name) ?? 0) + 1)
    const valorPedido = order.items.reduce((sum, oi) => sum + oi.quantity * oi.item.price, 0)
    consumoFilialMap.set(order.branch.name, (consumoFilialMap.get(order.branch.name) ?? 0) + valorPedido)
  }
  const porFilial = [...porFilialMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
  const consumoPorFilial = [...consumoFilialMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
  const consumoTotal = consumoPorFilial.reduce((sum, row) => sum + row.value, 0)

  const porItemMap = new Map<string, number>()
  for (const order of filteredOrders) {
    for (const orderItem of order.items) {
      porItemMap.set(orderItem.item.name, (porItemMap.get(orderItem.item.name) ?? 0) + orderItem.quantity)
    }
  }
  const topItens = [...porItemMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const trend = buildTrend(filteredOrders)

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">Panorama geral dos pedidos de uso e consumo.</p>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {DATE_PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDatePreset(option.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                datePreset === option.value
                  ? 'bg-novamix-teal/10 text-novamix-teal'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {datePreset === 'periodo' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <span className="text-sm text-gray-500">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        )}

        {branchOptions.length > 1 && (
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Todas as filiais</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<BoxIcon className="h-4 w-4" />} tone="teal" label="Total de pedidos" value={String(totalPedidos)} />
        <StatCard
          icon={<ClockIcon className="h-4 w-4" />}
          tone="orange"
          label="Em andamento"
          value={String(pendentes)}
          hint="ainda não entregues"
        />
        <StatCard
          icon={<TruckIcon className="h-4 w-4" />}
          tone="orange"
          label="Aguardando confirmação"
          value={String(aguardandoConfirmacao)}
          hint="status enviado"
        />
        <StatCard icon={<CheckIcon className="h-4 w-4" />} tone="teal" label="Entregues" value={String(entregues)} />
        <StatCard
          icon={<CoinIcon className="h-4 w-4" />}
          tone="orange"
          label="Valor consumido"
          value={formatCurrency(consumoTotal)}
          hint="soma dos itens pedidos"
        />
      </div>

      {totalPedidos === 0 ? (
        <p className="text-gray-500">Nenhum pedido encontrado para esse período/filial.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Pedidos ao longo do tempo">
            <TrendChart points={trend} color={TEAL} />
          </ChartCard>
          <ChartCard title="Pedidos por estágio">
            <StageBar segments={porStatus} />
          </ChartCard>
          <ChartCard title="Pedidos por filial">
            <HorizontalBarChart rows={porFilial} color={TEAL} />
          </ChartCard>
          <ChartCard title="Itens mais pedidos">
            <HorizontalBarChart rows={topItens} color={TEAL} />
          </ChartCard>
          <ChartCard title="Consumo por filial (R$)">
            <HorizontalBarChart rows={consumoPorFilial} color={ORANGE} formatValue={formatCurrency} />
          </ChartCard>
        </div>
      )}
    </div>
  )
}
