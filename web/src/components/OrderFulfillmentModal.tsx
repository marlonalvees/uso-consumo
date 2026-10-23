import { useEffect, useState } from 'react'
import { api, ApiError, assetUrl } from '../lib/api'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'
import type { BranchRef, Order } from '../types'
import { btnPrimary, btnSecondary, inputClass, labelClass, sectionTitle, selectClass } from '../lib/ui'
import { CloseIcon, ImageIcon, PlusIcon } from './icons'
import Sheet from './ui/Sheet'
import QuantityStepper from './ui/QuantityStepper'
import ItemSearchSelect from './ItemSearchSelect'

interface ItemRow {
  itemId: string
  name: string
  packagingName: string
  photoPath: string | null
  stock: number
  requestedQuantity: number
  quantity: number
  adjustReason: string
}

interface ExtraRow {
  id?: string
  name: string
  requestedQuantity: number
  quantity: number
  adjustReason: string
}

const QUICK_REASONS = ['Sem estoque', 'Estoque baixo', 'Quantidade ajustada', 'Substituído']

function ReasonPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-amber-50 p-2.5">
      <p className="text-xs font-semibold text-amber-800">Por que mudou? A filial vai ver.</p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_REASONS.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => onChange(quick)}
            className={`press rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              value === quick ? 'bg-amber-600 text-white' : 'bg-white text-amber-800 ring-1 ring-amber-200'
            }`}
          >
            {quick}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ou escreva o motivo"
        aria-label="Motivo da mudança"
        className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm"
      />
    </div>
  )
}

interface OrderFulfillmentModalProps {
  order: Order | null
  /** "admin" ajusta o que vai ser enviado; "owner" é a filial editando o pedido em Recebido */
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
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!order) return
    setItemRows(
      order.items.map((oi) => ({
        itemId: oi.itemId,
        name: oi.item.name,
        packagingName: oi.item.packaging.name,
        photoPath: oi.item.photoPath,
        stock: catalogItems.find((i) => i.id === oi.itemId)?.stockQuantity ?? oi.item.stockQuantity,
        requestedQuantity: oi.requestedQuantity,
        quantity: oi.quantity,
        adjustReason: oi.adjustReason ?? '',
      })),
    )
    setExtraRows(
      order.extraItems.map((extra) => ({
        id: extra.id,
        name: extra.name,
        requestedQuantity: extra.requestedQuantity,
        quantity: extra.quantity,
        adjustReason: extra.adjustReason ?? '',
      })),
    )
    setAddItemId('')
    setBranchId(order.branchId)
    setNotes((mode === 'owner' ? order.notes : order.adminNotes) ?? '')
    // só reinicia ao abrir outro pedido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  if (!order) return null
  const orderId = order.id
  const isOwnerMode = mode === 'owner'
  const shipped = order.status === 'ENVIADO' || order.status === 'ENTREGUE'

  const availableToAdd = catalogItems.filter((item) => item.active && !itemRows.some((row) => row.itemId === item.id))

  function patchItem(itemId: string, change: Partial<ItemRow>) {
    setItemRows((prev) => prev.map((row) => (row.itemId === itemId ? { ...row, ...change } : row)))
  }

  function patchExtra(index: number, change: Partial<ExtraRow>) {
    setExtraRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...change } : row)))
  }

  function addItemRow(itemId: string) {
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item) return
    setItemRows((prev) => [
      ...prev,
      {
        itemId: item.id,
        name: item.name,
        packagingName: item.packaging.name,
        photoPath: item.photoPath,
        stock: item.stockQuantity,
        requestedQuantity: 0,
        quantity: 1,
        adjustReason: '',
      },
    ])
    setAddItemId('')
  }

  async function handleSave() {
    if (extraRows.some((row) => !row.name.trim())) {
      toast.error('Todo item extra precisa de um nome')
      return
    }
    if (isOwnerMode && !branchId) {
      toast.error('Selecione a filial')
      return
    }

    setSaving(true)
    try {
      const updated = isOwnerMode
        ? await api.patch<Order>(`/orders/${orderId}/edit`, {
            branchId,
            notes: notes.trim() || null,
            items: itemRows.filter((row) => row.quantity > 0).map((row) => ({ itemId: row.itemId, quantity: row.quantity })),
            extras: extraRows.filter((row) => row.quantity > 0).map((row) => ({ name: row.name.trim(), quantity: row.quantity })),
          })
        : await api.patch<Order>(`/orders/${orderId}/fulfillment`, {
            adminNotes: notes.trim() || null,
            items: itemRows.map((row) => ({ itemId: row.itemId, quantity: row.quantity, adjustReason: row.adjustReason.trim() || null })),
            extras: extraRows.map((row) => ({
              id: row.id,
              name: row.name.trim(),
              quantity: row.quantity,
              adjustReason: row.adjustReason.trim() || null,
            })),
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
    <Sheet
      open
      onClose={onClose}
      dismissible={false}
      variant="drawer"
      title={isOwnerMode ? 'Editar pedido' : 'Ajustar itens do pedido'}
      subtitle={isOwnerMode ? 'Dá pra mudar enquanto a central não começou a separar' : order.branch.name}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${btnSecondary} flex-1`}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className={`${btnPrimary} flex-2`}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {!isOwnerMode && shipped && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Esse pedido já foi {order.status === 'ENVIADO' ? 'enviado' : 'entregue'}. Mudar as quantidades devolve ou baixa a
            diferença do estoque automaticamente.
          </p>
        )}

        {isOwnerMode && branches.length > 1 && (
          <div>
            <label htmlFor="edit-branch" className={labelClass}>
              Filial
            </label>
            <select
              id="edit-branch"
              value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className={`${selectClass} w-full`}
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
          <p className={`${sectionTitle} mb-2`}>Produtos</p>
          {itemRows.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum produto neste pedido.</p>
          ) : (
            <ul className="space-y-2">
              {itemRows.map((row) => {
                const reduced = !isOwnerMode && row.requestedQuantity > 0 && row.quantity < row.requestedQuantity
                const lowStock = !isOwnerMode && row.quantity > row.stock
                return (
                  <li key={row.itemId} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-300">
                        {row.photoPath ? (
                          <img src={assetUrl(row.photoPath)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold wrap-break-word text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-500">
                          {row.packagingName}
                          {row.requestedQuantity > 0 ? ` · pedido: ${row.requestedQuantity}` : ' · incluído agora'}
                          {!isOwnerMode && (
                            <span className={lowStock ? 'font-bold text-red-600' : ''}> · estoque: {row.stock}</span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          isOwnerMode
                            ? setItemRows((prev) => prev.filter((r) => r.itemId !== row.itemId))
                            : patchItem(row.itemId, { quantity: 0 })
                        }
                        aria-label={`Tirar ${row.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <QuantityStepper
                        value={row.quantity}
                        onChange={(value) => patchItem(row.itemId, { quantity: value })}
                        label={row.name}
                        size="sm"
                        editable
                      />
                    </div>
                    {reduced && (
                      <ReasonPicker value={row.adjustReason} onChange={(value) => patchItem(row.itemId, { adjustReason: value })} />
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {availableToAdd.length > 0 && (
            <div className="mt-3">
              <ItemSearchSelect
                items={availableToAdd}
                value={addItemId}
                onChange={(itemId) => itemId && addItemRow(itemId)}
                placeholder="Adicionar produto ao pedido..."
              />
            </div>
          )}
        </div>

        <div>
          <p className={`${sectionTitle} mb-2`}>Itens extras</p>
          {extraRows.length === 0 && <p className="text-sm text-gray-500">Nenhum item extra.</p>}
          <ul className="space-y-2">
            {extraRows.map((row, index) => {
              const reduced = !isOwnerMode && row.requestedQuantity > 0 && row.quantity < row.requestedQuantity
              return (
                <li key={row.id ?? `new-${index}`} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200">
                  <div className="flex items-center gap-2">
                    {row.id ? (
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold wrap-break-word text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-500">extra · pedido: {row.requestedQuantity}</p>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => patchExtra(index, { name: e.target.value })}
                        placeholder="Nome do item"
                        aria-label="Nome do item extra"
                        className={`${inputClass} min-w-0 flex-1`}
                      />
                    )}
                    <QuantityStepper
                      value={row.quantity}
                      onChange={(value) => patchExtra(index, { quantity: value })}
                      label={row.name || 'item extra'}
                      size="sm"
                      editable
                    />
                    <button
                      type="button"
                      onClick={() => setExtraRows((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remover item extra"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {reduced && <ReasonPicker value={row.adjustReason} onChange={(value) => patchExtra(index, { adjustReason: value })} />}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => setExtraRows((prev) => [...prev, { name: '', requestedQuantity: 0, quantity: 1, adjustReason: '' }])}
            className="press mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-orange-base"
          >
            <PlusIcon className="h-4 w-4" /> Adicionar item extra
          </button>
        </div>

        <div>
          <label htmlFor="fulfillment-notes" className={labelClass}>
            {isOwnerMode ? 'Observação para a central' : 'Observação para a filial'}
          </label>
          <textarea
            id="fulfillment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={isOwnerMode ? 'Ex.: precisa chegar até sexta' : 'Ex.: o restante do durex vai no próximo envio'}
            className={inputClass}
          />
        </div>
      </div>
    </Sheet>
  )
}
