import { useEffect, useState } from 'react'
import { api, ApiError, assetUrl } from '../lib/api'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'
import type { BranchRef, Order } from '../types'
import { CloseIcon, ImageIcon, ZoomInIcon } from './icons'
import PhotoLightbox from './PhotoLightbox'

interface ItemRow {
  itemId: string
  name: string
  packagingName: string
  photoPath: string | null
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
  mode?: 'admin' | 'owner'
  branches?: BranchRef[]
  onClose: () => void
  onSaved: (order: Order) => void
}

export default function OrderFulfillmentModal({
  order,
  mode = 'admin',
  branches = [],
  onClose,
  onSaved,
}: OrderFulfillmentModalProps) {
  const { items: catalogItems } = useItems()
  const toast = useToast()

  const [itemRows, setItemRows] = useState<ItemRow[]>([])
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([])
  const [addItemId, setAddItemId] = useState('')
  const [branchId, setBranchId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [previewRow, setPreviewRow] = useState<ItemRow | null>(null)

  useEffect(() => {
    if (!order) return
    setItemRows(
      order.items.map((oi) => ({
        itemId: oi.itemId,
        name: oi.item.name,
        packagingName: oi.item.packaging.name,
        photoPath: oi.item.photoPath,
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
    setBranchId(order.branchId)
  }, [order])

  if (!order) return null
  const orderId = order.id
  const isOwnerMode = mode === 'owner'

  const availableToAdd = catalogItems.filter(
    (item) => item.active && !itemRows.some((row) => row.itemId === item.id),
  )

  function updateItemQuantity(itemId: string, delta: number) {
    setItemRows((prev) =>
      prev.map((row) => (row.itemId === itemId ? { ...row, quantity: Math.max(0, row.quantity + delta) } : row)),
    )
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
      {
        itemId: item.id,
        name: item.name,
        packagingName: item.packaging.name,
        photoPath: item.photoPath,
        requestedQuantity: 0,
        quantity: 1,
      },
    ])
    setAddItemId('')
  }

  function updateExtraQuantity(index: number, delta: number) {
    setExtraRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, quantity: Math.max(0, row.quantity + delta) } : row)),
    )
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
    if (isOwnerMode && !branchId) {
      toast.error('Selecione a filial')
      return
    }

    setSaving(true)
    try {
      const endpoint = isOwnerMode ? `/orders/${orderId}/edit` : `/orders/${orderId}/fulfillment`
      const updated = await api.patch<Order>(endpoint, {
        ...(isOwnerMode ? { branchId } : {}),
        items: itemRows.map((row) => ({ itemId: row.itemId, quantity: row.quantity })),
        extras: extraRows.map((row) => ({ id: row.id, name: row.name.trim(), quantity: row.quantity })),
      })
      toast.success(isOwnerMode ? 'Pedido atualizado' : 'Itens do pedido atualizados')
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
            <h2 className="text-base font-semibold text-gray-900">
              {isOwnerMode ? 'Editar meu pedido' : 'Editar itens do pedido'}
            </h2>
            {!isOwnerMode && <p className="text-sm text-gray-500">{order.branch.name}</p>}
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
          {isOwnerMode && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Filial</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-novamix-teal-dark">
              Produtos
            </h3>
            {itemRows.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum produto neste pedido.</p>
            ) : (
              <ul className="space-y-2">
                {itemRows.map((row) => (
                  <li key={row.itemId} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => row.photoPath && setPreviewRow(row)}
                          aria-label={row.photoPath ? `Ver foto de ${row.name}` : undefined}
                          className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-300 ${
                            row.photoPath ? '' : 'pointer-events-none'
                          }`}
                        >
                          {row.photoPath ? (
                            <>
                              <img
                                src={assetUrl(row.photoPath)}
                                alt={row.name}
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition hover:bg-black/30 hover:opacity-100">
                                <ZoomInIcon className="h-4 w-4" />
                              </span>
                            </>
                          ) : (
                            <ImageIcon className="h-5 w-5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-medium wrap-break-word text-gray-900">{row.name}</p>
                          <p className="text-xs text-gray-400">
                            {row.packagingName}
                            {row.requestedQuantity > 0 ? ` · pedido: ${row.requestedQuantity}` : ' · adicionado agora'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemRow(row.itemId)}
                        aria-label="Remover"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(row.itemId, -1)}
                        disabled={row.quantity === 0}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-8 shrink-0 text-center font-medium text-gray-900">{row.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(row.itemId, 1)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {availableToAdd.length > 0 && (
              <div className="mt-2 flex gap-2">
                <select
                  value={addItemId}
                  onChange={(e) => setAddItemId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
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
                  className="shrink-0 rounded-lg border border-novamix-teal px-3 py-2 text-sm font-medium text-novamix-teal transition hover:bg-novamix-teal/10 disabled:opacity-40"
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
                  <li key={row.id ?? `new-${index}`} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      {row.id ? (
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium wrap-break-word text-gray-900">{row.name}</p>
                          <p className="text-xs text-gray-400">extra · pedido: {row.requestedQuantity}</p>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateNewExtraName(index, e.target.value)}
                          placeholder="Nome do item"
                          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeExtraRow(index)}
                        aria-label="Remover"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => updateExtraQuantity(index, -1)}
                        disabled={row.quantity === 0}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-lg font-semibold text-gray-700 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-8 shrink-0 text-center font-medium text-gray-900">{row.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateExtraQuantity(index, 1)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-novamix-teal text-lg font-semibold text-novamix-teal"
                      >
                        +
                      </button>
                    </div>
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

      <PhotoLightbox
        src={previewRow?.photoPath ? assetUrl(previewRow.photoPath) : null}
        alt={previewRow?.name ?? ''}
        onClose={() => setPreviewRow(null)}
      />
    </div>
  )
}
