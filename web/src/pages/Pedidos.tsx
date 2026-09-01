import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Branch } from '../types'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import { useToast } from '../context/ToastContext'
import NovoPedido from './NovoPedido'
import MeusPedidos from './MeusPedidos'

type Tab = 'novo' | 'recentes' | 'meus'

const TABS: { value: Tab; label: string }[] = [
  { value: 'novo', label: 'Novo pedido' },
  { value: 'recentes', label: 'Pedidos recentes' },
  { value: 'meus', label: 'Meus pedidos' },
]

export default function Pedidos() {
  const { user } = useAuth()
  const { orders } = useOrders()
  const toast = useToast()
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
        setBranchId('')
      })
      .catch(() => {
        setError('Não foi possível carregar as filiais')
        toast.error('Não foi possível carregar as filiais')
      })
      .finally(() => setLoading(false))
  }, [isAdmin, user, toast])

  const selectedBranchName = branches.find((b) => b.id === branchId)?.name

  const awaitingCount = useMemo(
    () =>
      orders.filter(
        (o) => (branchId ? o.branchId === branchId : true) && o.status === 'ENVIADO',
      ).length,
    [orders, branchId],
  )

  if (loading) {
    return <p className="text-gray-500">Carregando...</p>
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pedidos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Faça pedidos de itens de uso e consumo e acompanhe o andamento.
          </p>
        </div>

        {branches.length > 0 && (isAdmin || branches.length > 1) && (
          <div className="sm:w-64">
            <label htmlFor="pedidos-branch" className="mb-1 block text-xs font-medium text-gray-500">
              Filial
            </label>
            <select
              id="pedidos-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
            >
              {isAdmin && <option value="">Todas as lojas</option>}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {branches.length === 0 ? (
        <p className="text-gray-500">
          Nenhuma filial liberada para você. Fale com o administrador do hub.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm sm:inline-grid sm:auto-cols-max sm:grid-flow-col">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`relative whitespace-nowrap rounded-md px-1.5 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                  tab === t.value
                    ? 'bg-novamix-teal/10 text-novamix-teal'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
                {t.value === 'recentes' && awaitingCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-novamix-orange px-1 text-[10px] font-semibold text-white sm:ml-1.5 sm:h-5 sm:min-w-5 sm:text-xs">
                    {awaitingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'novo' &&
            (branchId === '' ? (
              <p className="text-gray-500">Selecione uma loja específica para criar um pedido.</p>
            ) : (
              <NovoPedido
                fixedBranchId={branchId}
                fixedBranchName={selectedBranchName}
                hideTitle
                onSuccess={() => setTab('recentes')}
              />
            ))}
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
