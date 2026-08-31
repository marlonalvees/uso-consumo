import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'
import type { Order } from '../types'
import { CloseIcon } from './icons'

interface ItemRow {
  itemId: string
  name: string
  packagingName: string
  requestedQuantity: number
  quantity: number
}

interface ExtraRow {
  id?: string
  name: string
  requestedQuantity: number
  quantity: number
}

interface OrderFulfillmentModalProps {
  order: Order | null
  onClose: () => void
  onSaved: (order: Order) => void
}

export default function OrderFulfillmentModal({ order, onClose, onSaved }: OrderFulfillmentModalProps) {
  const { items: catalogItems } = useItems()
  const toast = useToast()

  const [itemRows, setItemRows] = useState<ItemRow[]>([])
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([])
  const [addItemId, setAddItemId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!order) return
    setItemRows(
      order.items.map((oi) => ({
        itemId: oi.itemId,
        name: oi.item.name,
        packagingName: oi.item.packaging.name,
        requestedQuantity: oi.requestedQuantity,
        quantity: oi.quantity,
      })),
    )
    setExtraRows(
      order.extraItems.map((extra) => ({
        id: extra.id,
        name: extra.name,
        requestedQuantity: extra.requestedQuantity,
        quantity: extra.quantity,
      })),
    )
    setAddItemId('')
  }, [order])

  if (!order) return null
  const orderId = order.id

  const availableToAdd = catalogItems.filter(
    (item) => item.active && !itemRows.some((row) => row.itemId === item.id),
  )

  function updateItemQuantity(itemId: string, quantity: number) {
    setItemRows((prev) => prev.map((row) => (row.itemId === itemId ? { ...row, quantity: Math.max(0, quantity) } : row)))
  }

  function removeItemRow(itemId: string) {
    setItemRows((prev) => prev.filter((row) => row.itemId !== itemId))
  }

  function addItemRow() {
    if (!addItemId) return
    const item = catalogItems.find((i) => i.id === addItemId)
    if (!item) return
    setItemRows((prev) => [
      ...prev,
      { itemId: item.id, name: item.name, packagingName: item.packaging.name, requestedQuantity: 0, quantity: 1 },
    ])
    setAddItemId('')
  }

  function updateExtraQuantity(index: number, quantity: number) {
    setExtraRows((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: Math.max(0, quantity) } : row)))
  }

  function updateNewExtraName(index: number, name: string) {
    setExtraRows((prev) => prev.map((row, i) => (i === index ? { ...row, name } : row)))
  }

  function removeExtraRow(index: number) {
    setExtraRows((prev) => prev.filter((_, i) => i !== index))
  }

  function addExtraRow() {
    setExtraRows((prev) => [...prev, { name: '', requestedQuantity: 0, quantity: 1 }])
  }

  async function handleSave() {
    const invalidExtra = extraRows.some((row) => !row.name.trim())
    if (invalidExtra) {
      toast.error('Todo item extra precisa de um nome')
      return
    }

    setSaving(true)
    try {
      const updated = await api.patch<Order>(`/orders/${orderId}/fulfillment`, {
        items: itemRows.map((row) => ({ itemId: row.itemId, quantity: row.quantity })),
        extras: extraRows.map((row) => ({ id: row.id, name: row.name.trim(), quantity: row.quantity })),
      })
      toast.success('Itens do pedido atualizados')
      onSaved(updated)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar as alterações')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Editar itens do pedido</h2>
            <p className="text-sm text-gray-500">{order.branch.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-400 text-white transition hover:bg-gray-500"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-novamix-teal-dark">
              Produtos
            </h3>
            {itemRows.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum produto neste pedido.</p>
            ) : (
              <ul className="space-y-2">
                {itemRows.map((row) => (
                  <li key={row.itemId} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-400">
                        {row.packagingName}
                        {row.requestedQuantity > 0 ? ` · pedido: ${row.requestedQuantity}` : ' · adicionado agora'}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => updateItemQuantity(row.itemId, Number(e.target.value))}
                      className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeItemRow(row.itemId)}
                      aria-label="Remover"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {availableToAdd.length > 0 && (
              <div className="mt-2 flex gap-2">
                <select
                  value={addItemId}
                  onChange={(e) => setAddItemId(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">Adicionar produto...</option>
                  {availableToAdd.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addItemRow}
                  disabled={!addItemId}
                  className="rounded-lg border border-novamix-teal px-3 py-1.5 text-sm font-medium text-novamix-teal transition hover:bg-novamix-teal/10 disabled:opacity-40"
                >
                  Adicionar
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-novamix-teal-dark">
              Extras
            </h3>
            {extraRows.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum item extra neste pedido.</p>
            ) : (
              <ul className="space-y-2">
                {extraRows.map((row, index) => (
                  <li key={row.id ?? `new-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
                    {row.id ? (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-400">extra · pedido: {row.requestedQuantity}</p>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateNewExtraName(index, e.target.value)}
                        placeholder="Nome do item"
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                      />
                    )}
                    <input
                      type="number"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => updateExtraQuantity(index, Number(e.target.value))}
                      className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraRow(index)}
                      aria-label="Remover"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addExtraRow}
              className="mt-2 text-sm font-medium text-novamix-teal hover:text-novamix-teal-dark"
            >
              + adicionar extra
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-novamix-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-teal-dark disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
