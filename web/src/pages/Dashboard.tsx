import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrders } from '../context/OrdersContext'
import { useItems } from '../context/ItemsContext'
import { STATUS_HEX, STATUS_LABELS, STATUS_ORDER } from '../lib/orderStatus'
import { DATE_PRESET_OPTIONS, matchesDatePreset, type DatePreset } from '../lib/dateFilter'
import { formatCurrency } from '../lib/format'
import { isLowStock } from '../lib/stock'
import { cardClass, selectClass } from '../lib/ui'
import { AlertIcon, BoxIcon, ChevronRightIcon, ClockIcon, CoinIcon, TruckIcon, CheckIcon, ClipboardIcon } from '../components/icons'
import StageBar from '../components/charts/StageBar'
import TrendChart from '../components/charts/TrendChart'
import HorizontalBarChart from '../components/charts/HorizontalBarChart'
import Tabs from '../components/ui/Tabs'
import { SkeletonCards } from '../components/ui/Skeleton'
import type { Order } from '../types'

const TEAL = '#0f6f63'
const ORANGE = '#ea8006'

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

// consumo = o que saiu da central, pelo custo guardado no envio
function orderValue(order: Order) {
  return order.items.reduce((sum, oi) => sum + oi.quantity * (oi.unitCost ?? oi.item.price), 0)
}

function StatCard({ icon: Icon, tone, label, value, hint }: { icon: ComponentType<{ className?: string }>; tone: string; label: string; value: string; hint?: string }) {
  return (
    <div className={`${cardClass} p-4`}>
      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${cardClass} p-5`}>
      <p className="mb-4 text-sm font-extrabold text-gray-900">{title}</p>
      {children}
    </div>
  )
}

function AttentionCard({ icon: Icon, tone, count, label, onClick }: { icon: ComponentType<{ className?: string }>; tone: string; count: number; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press ${cardClass} flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-float`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl leading-tight font-extrabold text-gray-900 tabular-nums">{count}</span>
        <span className="block text-xs font-semibold text-gray-500">{label}</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 text-gray-400" />
    </button>
  )
}

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000

export default function Dashboard() {
  const navigate = useNavigate()
  const { orders, loadingOrders } = useOrders()
  const { items } = useItems()

  const [datePreset, setDatePreset] = useState<DatePreset>('mes')
  const [filterBranch, setFilterBranch] = useState<number | ''>('')

  const branchOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const order of orders) map.set(order.branch.id, order.branch.name)
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [orders])

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (order.status === 'CANCELADO') return false
        if (filterBranch && order.branch.id !== filterBranch) return false
        return matchesDatePreset(order.createdAt, datePreset, '', '')
      }),
    [orders, filterBranch, datePreset],
  )

  // consumo pela data de envio (não pela do pedido): é quando sai do estoque
  const shippedOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (order.status === 'ENVIADO' || order.status === 'ENTREGUE') &&
          order.sentAt &&
          (!filterBranch || order.branch.id === filterBranch) &&
          matchesDatePreset(order.sentAt, datePreset, '', ''),
      ),
    [orders, filterBranch, datePreset],
  )

  if (loadingOrders) return <SkeletonCards count={3} className="h-28" />

  const now = Date.now()
  const newOrders = orders.filter((o) => o.status === 'RECEBIDO').length
  const staleShipped = orders.filter((o) => o.status === 'ENVIADO' && o.sentAt && now - new Date(o.sentAt).getTime() > THREE_DAYS).length
  const belowMin = items.filter((item) => item.active && isLowStock(item)).length
  const cancelled = orders.filter(
    (o) => o.status === 'CANCELADO' && (!filterBranch || o.branch.id === filterBranch) && matchesDatePreset(o.createdAt, datePreset, '', ''),
  ).length

  const totalPedidos = filteredOrders.length
  const entregues = filteredOrders.filter((o) => o.status === 'ENTREGUE').length
  const aguardandoConfirmacao = filteredOrders.filter((o) => o.status === 'ENVIADO').length
  const pendentes = totalPedidos - entregues

  const porStatus = STATUS_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    value: filteredOrders.filter((o) => o.status === status).length,
    color: STATUS_HEX[status],
  }))

  const porFilialMap = new Map<string, number>()
  for (const order of filteredOrders) porFilialMap.set(order.branch.name, (porFilialMap.get(order.branch.name) ?? 0) + 1)
  const porFilial = [...porFilialMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  const consumoFilialMap = new Map<string, number>()
  for (const order of shippedOrders) consumoFilialMap.set(order.branch.name, (consumoFilialMap.get(order.branch.name) ?? 0) + orderValue(order))
  const consumoPorFilial = [...consumoFilialMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
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
      <h1 className="text-2xl font-extrabold text-gray-900">Início</h1>
      <p className="mb-5 text-sm text-gray-500">Panorama dos pedidos de uso e consumo.</p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AttentionCard
          icon={ClipboardIcon}
          tone="bg-red-50 text-red-600"
          count={newOrders}
          label="pedidos novos para separar"
          onClick={() => navigate('/gestao', { state: { focusStatus: 'RECEBIDO' } })}
        />
        <AttentionCard
          icon={TruckIcon}
          tone="bg-blue-50 text-blue-600"
          count={staleShipped}
          label="enviados há mais de 3 dias sem confirmação"
          onClick={() => navigate('/gestao', { state: { focusStatus: 'ENVIADO' } })}
        />
        <AttentionCard
          icon={AlertIcon}
          tone="bg-amber-50 text-amber-700"
          count={belowMin}
          label="itens no estoque mínimo ou abaixo"
          onClick={() => navigate('/compras')}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs
          value={datePreset}
          onChange={setDatePreset}
          tabs={DATE_PRESET_OPTIONS.filter((o) => o.value !== 'periodo').map((o) => ({ value: o.value, label: o.label }))}
        />
        {branchOptions.length > 1 && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value ? Number(e.target.value) : '')} aria-label="Filial" className={selectClass}>
            <option value="">Todas as filiais</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={BoxIcon} tone="bg-novamix-teal/10 text-novamix-teal" label="Pedidos" value={String(totalPedidos)} hint={cancelled ? `${cancelled} cancelado(s) fora da conta` : undefined} />
        <StatCard icon={ClockIcon} tone="bg-amber-50 text-amber-700" label="Em andamento" value={String(pendentes)} hint="ainda não entregues" />
        <StatCard icon={TruckIcon} tone="bg-blue-50 text-blue-600" label="Aguardando a filial" value={String(aguardandoConfirmacao)} hint="enviados, sem confirmação" />
        <StatCard icon={CheckIcon} tone="bg-emerald-50 text-emerald-600" label="Entregues" value={String(entregues)} />
        <StatCard icon={CoinIcon} tone="bg-orange-base/10 text-orange-base" label="Valor consumido" value={formatCurrency(consumoTotal)} hint="o que saiu da central, pelo custo" />
      </div>

      {totalPedidos === 0 ? (
        <p className="text-gray-500">Nenhum pedido encontrado para esse período/filial.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Pedidos ao longo do tempo">
            <TrendChart points={trend} color={TEAL} />
          </ChartCard>
          <ChartCard title="Pedidos por etapa">
            <StageBar segments={porStatus} />
          </ChartCard>
          <ChartCard title="Pedidos por filial">
            <HorizontalBarChart rows={porFilial} color={TEAL} />
          </ChartCard>
          <ChartCard title="Itens mais pedidos">
            <HorizontalBarChart rows={topItens} color={TEAL} />
          </ChartCard>
          <ChartCard title="Consumo por filial (R$)">
            <HorizontalBarChart rows={consumoPorFilial} color={ORANGE} formatValue={formatCurrency} emptyLabel="Nada enviado no período." />
          </ChartCard>
        </div>
      )}
    </div>
  )
}
