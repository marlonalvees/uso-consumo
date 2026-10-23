import type { Order } from '../../types'
import logoNm from '../../assets/logos/logo-nm.jpeg'

interface PickLine {
  name: string
  unit: string
  total: number
  byBranch: Map<string, number>
}

/**
 * Lista de separação de vários pedidos de uma vez: cada produto aparece uma vez, com o total
 * e quanto vai pra cada filial. Uma ida ao estoque em vez de uma por pedido.
 */
export default function PickListPrint({ orders }: { orders: Order[] }) {
  const lines = new Map<string, PickLine>()
  function add(key: string, name: string, unit: string, branch: string, quantity: number) {
    if (quantity <= 0) return
    const line = lines.get(key) ?? { name, unit, total: 0, byBranch: new Map() }
    line.total += quantity
    line.byBranch.set(branch, (line.byBranch.get(branch) ?? 0) + quantity)
    lines.set(key, line)
  }
  for (const order of orders) {
    for (const oi of order.items) add(oi.itemId, oi.item.name, oi.item.packaging.name, order.branch.name, oi.quantity)
    for (const extra of order.extraItems) add(`extra:${extra.name.toLowerCase()}`, extra.name, 'extra', order.branch.name, extra.quantity)
  }
  const sorted = [...lines.values()].sort((a, b) => a.name.localeCompare(b.name))
  const branches = [...new Set(orders.map((o) => o.branch.name))]

  return (
    <div className="mx-auto w-full max-w-[190mm] bg-white p-4 text-gray-900">
      <div className="mb-3 flex items-center gap-3">
        <img src={logoNm} alt="Logo Novamix" className="h-12 w-auto rounded-md" />
        <div className="flex-1">
          <p className="text-lg font-extrabold uppercase">Lista de separação</p>
          <p className="text-sm">
            {new Date().toLocaleDateString('pt-BR')} · {orders.length} pedidos · {branches.join(', ')}
          </p>
        </div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#1c2b4a] text-left text-xs text-white">
            <th className="w-8 px-2 py-1.5">✓</th>
            <th className="px-2 py-1.5">Produto</th>
            <th className="px-2 py-1.5 text-center">Total</th>
            <th className="px-2 py-1.5">Por filial</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((line, index) => (
            <tr key={line.name + index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="px-2 py-1.5">
                <span className="inline-block h-4 w-4 border border-gray-500" />
              </td>
              <td className="px-2 py-1.5 font-semibold">
                {line.name} <span className="text-xs font-normal text-gray-600">({line.unit})</span>
              </td>
              <td className="px-2 py-1.5 text-center text-base font-extrabold">{line.total}</td>
              <td className="px-2 py-1.5 text-xs">
                {[...line.byBranch.entries()].map(([branch, quantity]) => `${branch}: ${quantity}`).join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
