import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { ItemCategory, Order } from '../types'
import { useOrders } from '../context/OrdersContext'
import { useItems } from '../context/ItemsContext'
import { useAuth } from '../context/AuthContext'

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  PAPELARIA: 'Produtos Papelaria',
  LIMPEZA: 'Produtos Limpeza',
}

const CATEGORY_ORDER: ItemCategory[] = ['PAPELARIA', 'LIMPEZA']

interface ExtraRow {
  id: string
  name: string
  quantity: number
}

function createEmptyExtraRow(): ExtraRow {
  return { id: crypto.randomUUID(), name: '', quantity: 0 }
}

interface NovoPedidoProps {
  readOnly?: boolean
  fixedBranchId?: number
  hideTitle?: boolean
}

export default function NovoPedido({ readOnly = false, fixedBranchId, hideTitle = false }: NovoPedidoProps = {}) {
  const navigate = useNavigate()
  const { addOrder } = useOrders()
  const { items, loadingItems } = useItems()
  const { user } = useAuth()
  const branches = user?.branches ?? []
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([createEmptyExtraRow()])
  const [branchId, setBranchId] = useState<number | ''>(
    fixedBranchId ?? (branches.length === 1 ? branches[0].id : ''),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (fixedBranchId !== undefined) setBranchId(fixedBranchId)
  }, [fixedBranchId])

  function updateQuantity(itemId: string, delta: number) {
    setQuantities((prev) => {
      const current = prev[itemId] ?? 0
      const next = Math.max(0, current + delta)
      return { ...prev, [itemId]: next }
    })
  }

  function updateExtraRow(id: string, patch: Partial<ExtraRow>) {
    setExtraRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addExtraRow() {
    setExtraRows((prev) => [...prev, createEmptyExtraRow()])
  }

  function removeExtraRow(id: string) {
    setExtraRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev))
  }

  const selectedItems = Object.entries(quantities).filter(([, qty]) => qty > 0)
  const validExtraRows = extraRows.filter((row) => row.name.trim().length > 0 && row.quantity > 0)

  async function handleSubmit() {
    setError(null)
    if (!branchId) {
      setError('Selecione a filial')
      return
    }
    if (selectedItems.length === 0 && validExtraRows.length === 0) {
      setError('Selecione ao menos um item')
      return
    }
    setSubmitting(true)
    try {
      const created = await api.post<Order>('/orders', {
        branchId,
        items: selectedItems.map(([itemId, quantity]) => ({ itemId, quantity })),
        extras: validExtraRows.map((row) => ({ name: row.name.trim(), quantity: row.quantity })),
      })
      addOrder(created)
      navigate('/pedidos')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingItems) {
    return <p className="text-gray-500">Carregando itens...</p>
  }

  const itemsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  const totalSelected = selectedItems.length + validExtraRows.length

  if (!readOnly && fixedBranchId === undefined && branches.length === 0) {
    return (
      <div>
        {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Novo pedido</h1>}
        <p className="text-gray-500">
          Nenhuma filial liberada para você. Fale com o administrador do hub.
        </p>
      </div>
    )
  }

  return (
    <div className={readOnly ? '' : 'pb-24'}>
      {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Novo pedido</h1>}

      {!readOnly && fixedBranchId === undefined && (
        <div className="mb-6">
          <label htmlFor="branch" className="mb-1 block text-sm font-medium text-gray-700">
            Filial
          </label>
          {branches.length === 1 ? (
            <p className="text-sm text-gray-900">{branches[0].name}</p>
          ) : (
            <select
              id="branch"
              value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
            >
              <option value="" disabled>
                Selecione a filial
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="space-y-6">
        {itemsByCategory.map((group) => (
          <div key={group.category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
              {CATEGORY_LABELS[group.category]}
            </h2>
            <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
              {group.items.map((item) => {
                const quantity = quantities[item.id] ?? 0
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.unit}</p>
                    </div>
                    <div className="flex items-center justify-end gap-3 sm:justify-start">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={quantity === 0}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 shrink-0 text-center font-medium text-gray-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal"
                      >
                        +
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
            Extras — escreva abaixo
          </h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {extraRows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateExtraRow(row.id, { name: e.target.value })}
                  placeholder="Nome do item"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal sm:flex-1"
                />
                <div className="flex items-center justify-end gap-3 sm:justify-start">
                  <button
                    type="button"
                    onClick={() => updateExtraRow(row.id, { quantity: Math.max(0, row.quantity - 1) })}
                    disabled={row.quantity === 0}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 shrink-0 text-center font-medium text-gray-900">{row.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateExtraRow(row.id, { quantity: row.quantity + 1 })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExtraRow(row.id)}
                    disabled={extraRows.length === 1}
                    className="shrink-0 px-1 text-lg text-gray-400 hover:text-red-500 disabled:opacity-0"
                    aria-label="Remover linha"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addExtraRow}
            className="mt-2 text-sm font-medium text-novamix-teal hover:text-novamix-teal-dark"
          >
            + adicionar linha
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white p-4 lg:left-64">
          <div className="mx-auto max-w-5xl">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || totalSelected === 0}
              className="w-full rounded-lg bg-novamix-orange px-4 py-3 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark disabled:opacity-60"
            >
              {submitting
                ? 'Enviando...'
                : `Enviar pedido${
                    totalSelected ? ` (${totalSelected} ${totalSelected === 1 ? 'item' : 'itens'})` : ''
                  }`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
