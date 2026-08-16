import type { Order, OrderItem } from '../types'
import logoNm from '../assets/logos/logo-nm.jpeg'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function ProductTable({ title, items }: { title: string; items: OrderItem[] }) {
  if (items.length === 0) return null

  return (
    <table className="mb-4 w-full table-fixed border-collapse text-sm">
      <thead>
        <tr>
          <th colSpan={3} className="bg-black px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-white">
            {title}
          </th>
        </tr>
        <tr>
          <th className="w-1/2 bg-[#1c2b4a] px-3 py-1 text-left text-xs font-semibold text-white">
            Produto
          </th>
          <th className="bg-[#1c2b4a] px-3 py-1 text-center text-xs font-semibold text-white">
            Quanto já tem
          </th>
          <th className="bg-[#1c2b4a] px-3 py-1 text-center text-xs font-semibold text-white">
            Quantidade solicitada
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((orderItem, index) => (
          <tr
            key={orderItem.id}
            className={index % 2 === 0 ? 'bg-[#22335a] text-white' : 'bg-gray-100 text-gray-800'}
          >
            <td className="px-3 py-1.5">{orderItem.item.name}</td>
            <td className="px-3 py-1.5" />
            <td className="px-3 py-1.5 text-center font-semibold">
              {orderItem.quantity} {orderItem.item.unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function OrderPrintSheet({ order }: { order: Order }) {
  const papelaria = order.items.filter((orderItem) => orderItem.item.category === 'PAPELARIA')
  const limpeza = order.items.filter((orderItem) => orderItem.item.category === 'LIMPEZA')

  return (
    <div className="mx-auto w-full max-w-[190mm] bg-white p-4 text-gray-900">
      <div className="mb-3 bg-[#1c2b4a] px-3 py-2 text-center text-base font-bold uppercase tracking-wide text-white">
        Controle de uso e consumo
      </div>

      <div className="mb-4 flex items-end gap-3">
        <img src={logoNm} alt="Logo Novamix" className="h-12 w-auto rounded-md bg-white" />
        <div className="flex-1">
          <div className="bg-black px-2 py-0.5 text-xs font-bold uppercase text-white">
            Solicitante
          </div>
          <div className="border border-t-0 border-gray-400 px-2 py-1.5 text-sm">
            {order.requestedBy.name}
          </div>
        </div>
        <div className="w-32">
          <div className="bg-black px-2 py-0.5 text-xs font-bold uppercase text-white">Data</div>
          <div className="border border-t-0 border-gray-400 px-2 py-1.5 text-sm">
            {formatDate(order.createdAt)}
          </div>
        </div>
        <div className="w-40">
          <div className="bg-black px-2 py-0.5 text-xs font-bold uppercase text-white">Filial</div>
          <div className="border border-t-0 border-gray-400 px-2 py-1.5 text-sm">
            {order.branch.name}
          </div>
        </div>
      </div>

      <ProductTable title="Produtos papelaria" items={papelaria} />
      <ProductTable title="Produtos limpeza" items={limpeza} />

      {order.extraItems.length > 0 && (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th colSpan={2} className="bg-black px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-white">
                Extras
              </th>
            </tr>
          </thead>
          <tbody>
            {order.extraItems.map((extra, index) => (
              <tr
                key={extra.id}
                className={index % 2 === 0 ? 'bg-[#22335a] text-white' : 'bg-gray-100 text-gray-800'}
              >
                <td className="px-3 py-1.5">{extra.name}</td>
                <td className="px-3 py-1.5 text-center font-semibold">{extra.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
