import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Item, StockMovement, StockMovementType } from '../types'
import { useToast } from '../context/ToastContext'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function movementOrigin(movement: StockMovement) {
  if (movement.type === 'ENTRADA' && movement.purchase) {
    return `Compra · ${movement.purchase.supplier.name}`
  }
  if (movement.type === 'SAIDA' && movement.order) {
    return `Pedido · ${movement.order.branch.name}`
  }
  return movement.reason
}

export default function GestaoEstoque() {
  const [items, setItems] = useState<Item[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const [adjustItemId, setAdjustItemId] = useState('')
  const [adjustType, setAdjustType] = useState<StockMovementType>('ENTRADA')
  const [adjustQuantity, setAdjustQuantity] = useState('1')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  function loadAll() {
    Promise.all([api.get<Item[]>('/items'), api.get<StockMovement[]>('/stock/movements')])
      .then(([itemsData, movementsData]) => {
        setItems(itemsData)
        setMovements(movementsData)
      })
      .catch(() => toast.error('Não foi possível carregar o estoque'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadAll, [])

  async function handleAdjust() {
    if (!adjustItemId) {
      toast.error('Selecione o produto')
      return
    }
    const quantity = Number(adjustQuantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade inteira maior que 0')
      return
    }

    setAdjusting(true)
    try {
      const updated = await api.post<Item>('/stock/adjustments', {
        itemId: adjustItemId,
        type: adjustType,
        quantity,
        reason: adjustReason.trim() || undefined,
      })
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      toast.success(
        adjustType === 'ENTRADA' ? 'Estoque ajustado — entrada registrada' : 'Estoque ajustado — saída registrada',
      )
      setAdjustQuantity('1')
      setAdjustReason('')
      api
        .get<StockMovement[]>('/stock/movements')
        .then(setMovements)
        .catch(() => {})
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível ajustar o estoque')
    } finally {
      setAdjusting(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando estoque...</p>
  }

  const activeItems = items.filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name))
  const lowStockCount = activeItems.filter((item) => item.stockQuantity <= item.minStock).length
  const selectedItem = activeItems.find((item) => item.id === adjustItemId)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Estoque atual de cada produto. Entra com compras ou balanço manual, sai quando um pedido é
          marcado como enviado ou por balanço manual.
        </p>
        {lowStockCount > 0 && (
          <span className="rounded-full bg-red-base/10 px-3 py-1 text-xs font-medium text-red-base">
            {lowStockCount} produto(s) abaixo do estoque mínimo
          </span>
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
        Balanço de estoque
      </h2>
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 sm:min-w-48">
            <label className="mb-1 block text-xs font-medium text-gray-500">Produto</label>
            <select
              value={adjustItemId}
              onChange={(e) => setAdjustItemId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
            >
              <option value="">Selecione o produto</option>
              {activeItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (estoque: {item.stockQuantity})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:w-44">
            <label className="mb-1 block text-xs font-medium text-gray-500">Tipo</label>
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setAdjustType('ENTRADA')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  adjustType === 'ENTRADA'
                    ? 'bg-novamix-teal/10 text-novamix-teal'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('SAIDA')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  adjustType === 'SAIDA'
                    ? 'bg-novamix-orange/10 text-novamix-orange-dark'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Remover
              </button>
            </div>
          </div>

          <div className="sm:w-28">
            <label className="mb-1 block text-xs font-medium text-gray-500">Quantidade</label>
            <input
              type="number"
              min="1"
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
            />
          </div>

          <div className="flex-1 sm:min-w-40">
            <label className="mb-1 block text-xs font-medium text-gray-500">Motivo (opcional)</label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Ex: contagem física, avaria"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
            />
          </div>

          <button
            type="button"
            onClick={handleAdjust}
            disabled={adjusting}
            className="rounded-lg bg-novamix-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark disabled:opacity-60"
          >
            {adjusting ? 'Salvando...' : 'Registrar balanço'}
          </button>
        </div>
        {selectedItem && adjustType === 'SAIDA' && (
          <p className="mt-2 text-xs text-gray-400">
            Estoque atual: {selectedItem.stockQuantity} {selectedItem.packaging.name}
          </p>
        )}
      </div>

      {activeItems.length === 0 ? (
        <p className="text-gray-500">Nenhum produto ativo cadastrado.</p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Produto</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Categoria</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Fornecedor</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Estoque</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeItems.map((item) => {
                const lowStock = item.stockQuantity <= item.minStock
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.category.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          lowStock ? 'bg-red-base/10 text-red-base' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {item.stockQuantity} {item.packaging.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.minStock}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
        Movimentações recentes
      </h2>
      {movements.length === 0 ? (
        <p className="text-gray-500">Nenhuma movimentação de estoque ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Data</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Produto</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Quantidade</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {formatDateTime(movement.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{movement.item.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        movement.type === 'ENTRADA'
                          ? 'bg-novamix-teal/15 text-novamix-teal-dark'
                          : 'bg-novamix-orange/15 text-novamix-orange-dark'
                      }`}
                    >
                      {movement.type === 'ENTRADA' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {movement.type === 'ENTRADA' ? '+' : '-'}
                    {movement.quantity} {movement.item.packaging.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{movementOrigin(movement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
