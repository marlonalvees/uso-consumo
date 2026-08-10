import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Branch } from '../types'
import NovoPedido from './NovoPedido'
import MeusPedidos from './MeusPedidos'

type Tab = 'pedidos' | 'novo'

export default function VisaoFilial() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [tab, setTab] = useState<Tab>('pedidos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Branch[]>('/branches')
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setBranchId(data[0].id)
      })
      .catch(() => setError('Não foi possível carregar as filiais'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-gray-500">Carregando filiais...</p>
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Visão da filial</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {branches.length === 0 ? (
        <p className="text-gray-500">Nenhuma filial cadastrada.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => setTab('pedidos')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === 'pedidos'
                    ? 'bg-novamix-teal/10 text-novamix-teal'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Meus pedidos
              </button>
              <button
                type="button"
                onClick={() => setTab('novo')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === 'novo'
                    ? 'bg-novamix-teal/10 text-novamix-teal'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Novo pedido
              </button>
            </div>
          </div>

          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
            Modo visualização — você está vendo exatamente o que a filial vê, sem poder enviar
            pedidos nem confirmar recebimentos em nome dela.
          </p>

          {tab === 'pedidos' && <MeusPedidos branchId={branchId} readOnly hideTitle />}
          {tab === 'novo' && <NovoPedido readOnly />}
        </>
      )}
    </div>
  )
}
