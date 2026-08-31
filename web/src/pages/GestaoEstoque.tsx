import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Item, StockMovement } from '../types'
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

  useEffect(() => {
    Promise.all([api.get<Item[]>('/items'), api.get<StockMovement[]>('/stock/movements')])
      .then(([itemsData, movementsData]) => {
        setItems(itemsData)
        setMovements(movementsData)
      })
      .catch(() => toast.error('Não foi possível carregar o estoque'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return <p className="text-gray-500">Carregando estoque...</p>
  }

  const activeItems = items.filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name))
  const lowStockCount = activeItems.filter((item) => item.stockQuantity <= item.minStock).length

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Estoque atual de cada produto. Entra com compras, sai quando um pedido é marcado como
          enviado.
        </p>
        {lowStockCount > 0 && (
          <span className="rounded-full bg-red-base/10 px-3 py-1 text-xs font-medium text-red-base">
            {lowStockCount} produto(s) abaixo do estoque mínimo
          </span>
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
