import { useOrders } from '../context/OrdersContext'
import type { OrderStatus } from '../types'
import { STATUS_LABELS } from '../lib/orderStatus'

const STATUS_ORDER: OrderStatus[] = [
  'PENDENTE',
  'EM_SEPARACAO',
  'AGUARDANDO_ENVIO',
  'ENVIADO',
  'ENTREGUE',
]

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function BarList({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: number }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">Sem dados.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-700">{row.label}</span>
                <span className="font-medium text-gray-900">{row.value}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-novamix-teal"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { orders, loadingOrders } = useOrders()

  if (loadingOrders) {
    return <p className="text-gray-500">Carregando dashboard...</p>
  }

  const totalPedidos = orders.length
  const entregues = orders.filter((o) => o.status === 'ENTREGUE').length
  const aguardandoConfirmacao = orders.filter((o) => o.status === 'ENVIADO').length
  const pendentes = totalPedidos - entregues

  const porStatus = STATUS_ORDER.map((status) => ({
    label: STATUS_LABELS[status],
    value: orders.filter((o) => o.status === status).length,
  }))

  const porFilialMap = new Map<string, number>()
  for (const order of orders) {
    porFilialMap.set(order.branch.name, (porFilialMap.get(order.branch.name) ?? 0) + 1)
  }
  const porFilial = [...porFilialMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  const porItemMap = new Map<string, number>()
  for (const order of orders) {
    for (const orderItem of order.items) {
      porItemMap.set(
        orderItem.item.name,
        (porItemMap.get(orderItem.item.name) ?? 0) + orderItem.quantity,
      )
    }
  }
  const topItens = [...porItemMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">Panorama geral dos pedidos de uso e consumo.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de pedidos" value={totalPedidos} />
        <StatCard label="Em andamento" value={pendentes} hint="ainda não entregues" />
        <StatCard label="Aguardando confirmação" value={aguardandoConfirmacao} hint="status enviado" />
        <StatCard label="Entregues" value={entregues} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BarList title="Pedidos por estágio" rows={porStatus} />
        <BarList title="Pedidos por filial" rows={porFilial} />
        <BarList title="Itens mais pedidos" rows={topItens} />
      </div>
    </div>
  )
}
