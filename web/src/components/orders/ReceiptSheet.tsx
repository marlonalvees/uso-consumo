import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../../lib/api'
import type { Order, ReceiptIssue } from '../../types'
import { useToast } from '../../context/ToastContext'
import { btnSecondary, btnTeal, inputClass, sectionTitle } from '../../lib/ui'
import { plural } from '../../lib/format'
import Sheet from '../ui/Sheet'
import QuantityStepper from '../ui/QuantityStepper'
import { CameraIcon, CheckIcon, CloseIcon } from '../icons'

interface LineState {
  key: string
  id: string
  extra: boolean
  name: string
  unit: string
  sent: number
  ok: boolean
  received: number
  issue: ReceiptIssue
}

function initialLines(order: Order): LineState[] {
  return [
    ...order.items
      .filter((oi) => oi.quantity > 0)
      .map((oi) => ({
        key: `i-${oi.id}`,
        id: oi.id,
        extra: false,
        name: oi.item.name,
        unit: oi.item.packaging.name,
        sent: oi.quantity,
        ok: true,
        received: oi.quantity,
        issue: 'FALTOU' as ReceiptIssue,
      })),
    ...order.extraItems
      .filter((extra) => extra.quantity > 0)
      .map((extra) => ({
        key: `e-${extra.id}`,
        id: extra.id,
        extra: true,
        name: extra.name,
        unit: 'item extra',
        sent: extra.quantity,
        ok: true,
        received: extra.quantity,
        issue: 'FALTOU' as ReceiptIssue,
      })),
  ]
}

interface ReceiptSheetProps {
  order: Order | null
  onClose: () => void
  onConfirmed: (order: Order) => void
}

/** Confirmação do recebimento item a item: o que chegou certo, o que faltou e o que veio avariado. */
export default function ReceiptSheet({ order, onClose, onConfirmed }: ReceiptSheetProps) {
  const toast = useToast()
  const [lines, setLines] = useState<LineState[]>([])
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!order) return
    setLines(initialLines(order))
    setNotes('')
    setPhoto(null)
  }, [order])

  function patch(key: string, change: Partial<LineState>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...change } : line)))
  }

  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  const problems = lines.filter((line) => !line.ok && line.received < line.sent)

  async function handleConfirm() {
    if (!order) return
    setSaving(true)
    try {
      const toEntry = (line: LineState) => ({
        id: line.id,
        receivedQuantity: line.ok ? line.sent : line.received,
        issue: line.ok ? null : line.issue,
      })
      let updated = await api.patch<Order>(`/orders/${order.id}/confirm-delivery`, {
        items: lines.filter((l) => !l.extra).map(toEntry),
        extras: lines.filter((l) => l.extra).map(toEntry),
        notes: notes.trim() || undefined,
      })
      if (photo) {
        const formData = new FormData()
        formData.append('photo', photo)
        updated = await api.upload<Order>(`/orders/${order.id}/receipt-photo`, formData).catch(() => {
          toast.error('O recebimento foi confirmado, mas a foto não foi enviada')
          return updated
        })
      }
      toast.success(problems.length ? 'Recebimento confirmado. A central vai ver o que faltou.' : 'Recebimento confirmado!')
      onConfirmed(updated)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível confirmar o recebimento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={order !== null}
      onClose={onClose}
      dismissible={false}
      title="Confirmar recebimento"
      subtitle={order ? `Filial ${order.branch.name}` : undefined}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${btnSecondary} flex-1`}>
            Voltar
          </button>
          <button type="button" onClick={handleConfirm} disabled={saving} className={`${btnTeal} flex-2`}>
            {saving ? 'Confirmando...' : problems.length ? `Confirmar · ${plural(problems.length, 'problema', 'problemas')}` : 'Chegou tudo certo'}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        Confira cada item. Se algo faltou ou veio avariado, toque em <strong>Teve problema</strong>: a central é avisada e o
        item volta como pendência no próximo pedido.
      </p>

      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.key}
            className={`rounded-2xl p-3 ring-1 transition-colors ${line.ok ? 'bg-white ring-gray-200' : 'bg-red-50/60 ring-red-200'}`}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{line.name}</p>
                <p className="text-xs text-gray-500">
                  Enviado: {line.sent} · {line.unit}
                </p>
              </div>
              <div className="flex shrink-0 rounded-full bg-gray-100 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => patch(line.key, { ok: true, received: line.sent })}
                  className={`press flex items-center gap-1 rounded-full px-2.5 py-1.5 transition-colors ${
                    line.ok ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  <CheckIcon className="h-3.5 w-3.5" /> Ok
                </button>
                <button
                  type="button"
                  onClick={() => patch(line.key, { ok: false, received: Math.max(0, line.sent - 1) })}
                  className={`press rounded-full px-2.5 py-1.5 transition-colors ${!line.ok ? 'bg-red-base text-white shadow-sm' : 'text-gray-600'}`}
                >
                  Teve problema
                </button>
              </div>
            </div>
            {!line.ok && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-3">
                <div className="flex gap-2">
                  {(['FALTOU', 'AVARIADO'] as ReceiptIssue[]).map((issue) => (
                    <button
                      key={issue}
                      type="button"
                      onClick={() => patch(line.key, { issue })}
                      className={`press rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                        line.issue === issue ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'
                      }`}
                    >
                      {issue === 'FALTOU' ? 'Faltou' : 'Veio avariado'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">Chegou bom:</span>
                  <QuantityStepper
                    value={line.received}
                    onChange={(value) => patch(line.key, { received: Math.min(value, line.sent) })}
                    label={line.name}
                    size="sm"
                  />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-3">
        <p className={sectionTitle}>Observação e foto (opcional)</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Ex.: a caixa do detergente chegou molhada"
          aria-label="Observação do recebimento"
          className={inputClass}
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        {photo && photoUrl ? (
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-2">
            <img src={photoUrl} alt="Foto do recebimento" className="h-14 w-14 rounded-xl object-cover" />
            <p className="min-w-0 flex-1 truncate text-sm text-gray-700">{photo.name}</p>
            <button type="button" onClick={() => setPhoto(null)} aria-label="Tirar foto" className="rounded-full p-2 text-gray-500 hover:bg-gray-200">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInput.current?.click()} className={`${btnSecondary} w-full`}>
            <CameraIcon className="h-4 w-4" /> Tirar foto do problema
          </button>
        )}
      </div>
    </Sheet>
  )
}
