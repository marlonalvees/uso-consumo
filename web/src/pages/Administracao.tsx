import { useState } from 'react'
import Produtos from './Produtos'
import GestaoPedidos from './GestaoPedidos'

type Tab = 'pedidos' | 'produtos'

export default function Administracao() {
  const [tab, setTab] = useState<Tab>('pedidos')

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Administração</h1>

      <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab('pedidos')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === 'pedidos'
              ? 'bg-novamix-teal/10 text-novamix-teal'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Gestão de pedidos
        </button>
        <button
          type="button"
          onClick={() => setTab('produtos')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === 'produtos'
              ? 'bg-novamix-teal/10 text-novamix-teal'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Produtos
        </button>
      </div>

      {tab === 'pedidos' && <GestaoPedidos />}
      {tab === 'produtos' && <Produtos hideTitle />}
    </div>
  )
}
