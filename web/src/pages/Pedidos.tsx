import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Branch } from '../types'
import { useAuth } from '../context/AuthContext'
import NovoPedido from './NovoPedido'
import MeusPedidos from './MeusPedidos'

type Tab = 'novo' | 'recentes' | 'meus'

export default function Pedidos() {
  const { user } = useAuth()
  const isAdmin = user?.isAdmin ?? false

  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<number | ''>('')
  const [tab, setTab] = useState<Tab>('novo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) {
      const ownBranches = user?.branches ?? []
      setBranches(ownBranches)
      if (ownBranches.length > 0) setBranchId(ownBranches[0].id)
      setLoading(false)
      return
    }

    api
      .get<Branch[]>('/branches')
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setBranchId(data[0].id)
      })
      .catch(() => setError('Não foi possível carregar as filiais'))
      .finally(() => setLoading(false))
  }, [isAdmin, user])

  if (loading) {
    return <p className="text-gray-500">Carregando...</p>
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Pedidos</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {branches.length === 0 ? (
        <p className="text-gray-500">
          Nenhuma filial liberada para você. Fale com o administrador do hub.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {(isAdmin || branches.length > 1) && (
              <select
                value={branchId}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
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
              <button
                type="button"
                onClick={() => setTab('recentes')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === 'recentes'
                    ? 'bg-novamix-teal/10 text-novamix-teal'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pedidos recentes
              </button>
              <button
                type="button"
                onClick={() => setTab('meus')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === 'meus'
                    ? 'bg-novamix-teal/10 text-novamix-teal'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Meus pedidos
              </button>
            </div>
          </div>

          {tab === 'novo' && (
            <NovoPedido fixedBranchId={branchId === '' ? undefined : branchId} hideTitle />
          )}
          {tab === 'recentes' && (
            <MeusPedidos branchId={branchId === '' ? undefined : branchId} hideTitle />
          )}
          {tab === 'meus' && (
            <MeusPedidos
              branchId={branchId === '' ? undefined : branchId}
              onlyMine
              hideTitle
            />
          )}
        </>
      )}
    </div>
  )
}
