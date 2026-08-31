import { useState } from 'react'
import Produtos from './Produtos'
import Categorias from './Categorias'
import Embalagens from './Embalagens'
import Fornecedores from './Fornecedores'

type Tab = 'produtos' | 'categorias' | 'embalagens' | 'fornecedores'

const TABS: { value: Tab; label: string }[] = [
  { value: 'produtos', label: 'Produtos' },
  { value: 'categorias', label: 'Categorias' },
  { value: 'embalagens', label: 'Embalagens' },
  { value: 'fornecedores', label: 'Fornecedores' },
]

export default function Cadastros() {
  const [tab, setTab] = useState<Tab>('produtos')

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Cadastros</h1>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.value
                ? 'bg-novamix-teal/10 text-novamix-teal'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'produtos' && <Produtos hideTitle />}
      {tab === 'categorias' && <Categorias hideTitle />}
      {tab === 'embalagens' && <Embalagens hideTitle />}
      {tab === 'fornecedores' && <Fornecedores hideTitle />}
    </div>
  )
}
