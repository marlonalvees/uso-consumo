import { useState, type ComponentType } from 'react'
import GestaoPedidos from './GestaoPedidos'
import GestaoEstoque from './GestaoEstoque'
import GestaoCompras from './GestaoCompras'
import { ClipboardIcon, CoinIcon, WarehouseIcon } from '../components/icons'

type Tab = 'pedidos' | 'estoque' | 'compras'

const TABS: { value: Tab; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: 'pedidos', label: 'Gestão de pedidos', Icon: ClipboardIcon },
  { value: 'estoque', label: 'Gestão de estoque', Icon: WarehouseIcon },
  { value: 'compras', label: 'Gestão de compras', Icon: CoinIcon },
]

export default function Administracao() {
  const [tab, setTab] = useState<Tab>('pedidos')

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Administração</h1>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.value
                ? 'bg-novamix-teal/10 text-novamix-teal'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pedidos' && <GestaoPedidos />}
      {tab === 'estoque' && <GestaoEstoque />}
      {tab === 'compras' && <GestaoCompras />}
    </div>
  )
}
