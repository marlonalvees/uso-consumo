import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Item, StockSuggestion } from '../types'
import { useToast } from '../context/ToastContext'
import { btnPrimary } from '../lib/ui'
import Sheet from './ui/Sheet'
import EmptyState from './ui/EmptyState'
import { SkeletonCards } from './ui/Skeleton'
import { SparklesIcon } from './icons'

interface Props {
  open: boolean
  items: Item[]
  onClose: () => void
  onApplied: (updated: Item[]) => void
}

/**
 * Mínimo e ideal sugeridos pelo consumo dos últimos 90 dias e pelo prazo do fornecedor
 * (ponto de pedido = consumo diário × prazo + estoque de segurança).
 */
export default function StockSuggestionsSheet({ open, items, onClose, onApplied }: Props) {
  const toast = useToast()
  const [suggestions, setSuggestions] = useState<StockSuggestion[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSuggestions(null)
    api
      .get<StockSuggestion[]>('/items/stock-suggestions')
      .then((data) => {
        const itemById = new Map(items.map((i) => [i.id, i]))
        // só o que tem consumo e muda alguma coisa
        const relevant = data.filter((s) => {
          const item = itemById.get(s.itemId)
          return item && s.suggestedMin !== null && (s.suggestedMin !== item.minStock || s.suggestedTarget !== item.targetStock)
        })
        setSuggestions(relevant)
        setSelected(new Set(relevant.map((s) => s.itemId)))
      })
      .catch(() => setSuggestions([]))
  }, [open, items])

  const itemById = new Map(items.map((i) => [i.id, i]))

  async function apply() {
    const entries = (suggestions ?? [])
      .filter((s) => selected.has(s.itemId))
      .map((s) => ({ itemId: s.itemId, minStock: s.suggestedMin!, targetStock: s.suggestedTarget }))
    if (entries.length === 0) return
    setSaving(true)
    try {
      const updated = await api.post<Item[]>('/items/stock-levels', { entries })
      toast.success(`Mínimo e ideal atualizados em ${entries.length} produto(s)`)
      onApplied(updated)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível aplicar as sugestões')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="drawer"
      title="Sugestões pelo consumo"
      subtitle="Mínimo = consumo no prazo de entrega + segurança; ideal = mínimo + 30 dias de consumo"
      footer={
        <button type="button" onClick={apply} disabled={saving || selected.size === 0} className={`${btnPrimary} w-full`}>
          {saving ? 'Aplicando...' : `Aplicar em ${selected.size} produto(s)`}
        </button>
      }
    >
      {suggestions === null ? (
        <SkeletonCards count={4} className="h-14" />
      ) : suggestions.length === 0 ? (
        <EmptyState icon={SparklesIcon} title="Nada a sugerir" description="Os produtos com consumo nos últimos 90 dias já estão com mínimo e ideal ajustados." compact />
      ) : (
        <ul className="divide-y divide-gray-100">
          {suggestions.map((s) => {
            const item = itemById.get(s.itemId)!
            return (
              <li key={s.itemId}>
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(s.itemId)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(s.itemId)) next.delete(s.itemId)
                        else next.add(s.itemId)
                        return next
                      })
                    }
                    className="h-4 w-4 accent-orange-base"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-gray-900">
                      {item.name} <span className="ml-1 rounded bg-gray-100 px-1.5 text-[11px] font-extrabold text-gray-600">{s.abcClass}</span>
                    </span>
                    <span className="block text-xs text-gray-500">
                      {s.avgDailyConsumption.toLocaleString('pt-BR')} por dia · entrega em {s.leadTimeDays} dias
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums">
                    <span className="block text-gray-400 line-through">
                      {item.minStock} / {item.targetStock ?? '—'}
                    </span>
                    <span className="block text-sm font-extrabold text-gray-900">
                      {s.suggestedMin} / {s.suggestedTarget}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
