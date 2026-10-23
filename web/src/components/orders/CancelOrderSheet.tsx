import { useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api'
import type { Order } from '../../types'
import { useToast } from '../../context/ToastContext'
import { btnDanger, btnSecondary, inputClass, labelClass } from '../../lib/ui'
import Sheet from '../ui/Sheet'

const QUICK_REASONS = {
  branch: ['Pedi errado', 'Não precisa mais', 'Vou refazer o pedido'],
  admin: ['Sem estoque na central', 'Pedido duplicado', 'Item descontinuado'],
}

interface CancelOrderSheetProps {
  order: Order | null
  /** a central precisa dizer o motivo; a filial pode cancelar sem explicar */
  asAdmin: boolean
  onClose: () => void
  onCancelled: (order: Order) => void
}

export default function CancelOrderSheet({ order, asAdmin, onClose, onCancelled }: CancelOrderSheetProps) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (order) setReason('')
  }, [order])

  async function handleCancel() {
    if (!order) return
    if (asAdmin && !reason.trim()) {
      toast.error('Informe o motivo do cancelamento')
      return
    }
    setSaving(true)
    try {
      const updated = await api.post<Order>(`/orders/${order.id}/cancel`, { reason: reason.trim() || undefined })
      toast.success('Pedido cancelado')
      onCancelled(updated)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível cancelar o pedido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={order !== null}
      onClose={onClose}
      size="sm"
      title="Cancelar pedido"
      subtitle={order ? `Filial ${order.branch.name}` : undefined}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${btnSecondary} flex-1`}>
            Voltar
          </button>
          <button type="button" onClick={handleCancel} disabled={saving} className={`${btnDanger} flex-1`}>
            {saving ? 'Cancelando...' : 'Cancelar pedido'}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-gray-600">
        {asAdmin
          ? 'A filial vai ver o motivo no acompanhamento do pedido.'
          : 'Depois de cancelado, a filial pode fazer um pedido novo.'}
      </p>
      <label htmlFor="cancel-reason" className={labelClass}>
        Motivo {asAdmin ? '' : '(opcional)'}
      </label>
      <div className="mb-2 flex flex-wrap gap-2">
        {QUICK_REASONS[asAdmin ? 'admin' : 'branch'].map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => setReason(quick)}
            className={`press rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              reason === quick ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {quick}
          </button>
        ))}
      </div>
      <textarea
        id="cancel-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Escreva o motivo"
        className={inputClass}
      />
    </Sheet>
  )
}
