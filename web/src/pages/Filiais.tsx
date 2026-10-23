import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { BranchOverview, BranchPar } from '../types'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'
import { normalizeText } from '../lib/text'
import { formatCurrency, plural } from '../lib/format'
import { btnPrimary, btnSecondary, cardClass, inputClass, selectClass } from '../lib/ui'
import Sheet from '../components/ui/Sheet'
import { SkeletonCards } from '../components/ui/Skeleton'
import { StatusPill } from '../components/ui/StatusPill'
import { SearchIcon, TargetIcon, WalletIcon } from '../components/icons'

/** Estoque ideal da filial: quanto ela deve ter de cada item (vira a sugestão de pedido). */
function ParEditorSheet({ branch, branches, onClose, onSaved }: { branch: BranchOverview | null; branches: BranchOverview[]; onClose: () => void; onSaved: () => void }) {
  const { items } = useItems()
  const toast = useToast()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async (branchId: number) => {
    setLoading(true)
    try {
      const pars = await api.get<BranchPar[]>(`/branches/${branchId}/pars`)
      setValues(Object.fromEntries(pars.map((par) => [par.itemId, String(par.quantity)])))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!branch) return
    setSearch('')
    load(branch.id)
  }, [branch, load])

  async function save() {
    if (!branch) return
    setSaving(true)
    try {
      const entries = Object.entries(values)
        .map(([itemId, value]) => ({ itemId, quantity: Math.max(0, Math.floor(Number(value) || 0)) }))
        .filter((entry) => entry.quantity > 0)
      await api.put(`/branches/${branch.id}/pars`, { entries })
      toast.success(`Estoque ideal da filial ${branch.name} salvo`)
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar')
    } finally {
      setSaving(false)
    }
  }

  const term = normalizeText(search)
  const visible = items.filter((item) => item.active && (!term || normalizeText(item.name).includes(term)))
  const filled = Object.values(values).filter((v) => Number(v) > 0).length

  return (
    <Sheet
      open={branch !== null}
      onClose={onClose}
      dismissible={false}
      variant="drawer"
      title={branch ? `Estoque ideal · ${branch.name}` : ''}
      subtitle="Quanto a filial deve ter de cada item. Deixe em branco o que ela não usa."
      footer={
        <button type="button" onClick={save} disabled={saving} className={`${btnPrimary} w-full`}>
          {saving ? 'Salvando...' : `Salvar · ${plural(filled, 'item', 'itens')}`}
        </button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-40 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" className={`${inputClass} pl-10`} />
        </div>
        <select
          value=""
          onChange={(e) => e.target.value && load(Number(e.target.value))}
          aria-label="Copiar de outra filial"
          className={selectClass}
        >
          <option value="">Copiar de outra filial…</option>
          {branches
            .filter((b) => b.id !== branch?.id && b.parCount > 0)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </select>
      </div>
      {loading ? (
        <SkeletonCards count={5} className="h-12" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {visible.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.packaging.name}</p>
              </div>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={values[item.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="—"
                aria-label={`Estoque ideal de ${item.name}`}
                className="w-20 rounded-xl border border-gray-200 px-2 py-2 text-center text-sm font-bold focus:border-orange-base focus:ring-2 focus:ring-orange-base/20 focus:outline-none"
              />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

function BudgetEditor({ branch, onSaved }: { branch: BranchOverview; onSaved: () => void }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  async function save() {
    const amount = value.trim() === '' ? null : Number(value.replace(',', '.'))
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      toast.error('Informe um valor válido')
      return
    }
    try {
      await api.put(`/branches/${branch.id}/budget`, { monthlyAmount: amount })
      toast.success(amount === null ? 'Cota removida' : 'Cota salva')
      setEditing(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar a cota')
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(branch.monthlyBudget !== null ? String(branch.monthlyBudget).replace('.', ',') : '')
          setEditing(true)
        }}
        className="press text-sm font-bold text-orange-base"
      >
        {branch.monthlyBudget !== null ? formatCurrency(branch.monthlyBudget) : 'Definir cota'}
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="sem cota"
        aria-label="Cota mensal em reais"
        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm"
      />
      <button type="button" onClick={save} className="press rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
        Ok
      </button>
    </span>
  )
}

/** Central: consumo, cota e estoque ideal de cada filial. */
export default function Filiais() {
  const toast = useToast()
  const [branches, setBranches] = useState<BranchOverview[] | null>(null)
  const [editingPars, setEditingPars] = useState<BranchOverview | null>(null)

  const load = useCallback(() => {
    api
      .get<BranchOverview[]>('/branches/overview')
      .then(setBranches)
      .catch(() => {
        setBranches([])
        toast.error('Não foi possível carregar as filiais')
      })
  }, [toast])

  useEffect(load, [load])

  const sorted = useMemo(() => [...(branches ?? [])].sort((a, b) => b.monthConsumption - a.monthConsumption), [branches])

  if (branches === null) return <SkeletonCards count={4} className="h-28" />

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        A cota é só um aviso para a filial (não bloqueia pedido). O estoque ideal vira a sugestão de pedido da filial.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {sorted.map((branch) => {
          const pct = branch.monthlyBudget ? Math.min(100, (branch.monthConsumption / branch.monthlyBudget) * 100) : null
          const above = branch.lastMonthsAverage > 0 && branch.monthConsumption > branch.lastMonthsAverage * 1.3
          return (
            <li key={branch.id} className={`${cardClass} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-gray-900">{branch.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {branch.openOrders.map((status, index) => (
                      <StatusPill key={index} status={status} />
                    ))}
                    {branch.pendingCount > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">{plural(branch.pendingCount, 'pendência', 'pendências')}</span>
                    )}
                  </div>
                </div>
                {above && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Acima da média</span>}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="flex items-center gap-1 text-xs font-bold text-gray-500">
                    <WalletIcon className="h-3.5 w-3.5" /> Consumo do mês
                  </p>
                  <p className="text-lg font-extrabold text-gray-900 tabular-nums">{formatCurrency(branch.monthConsumption)}</p>
                  <p className="text-xs text-gray-500">média 3 meses: {formatCurrency(branch.lastMonthsAverage)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500">Cota mensal</p>
                  <BudgetEditor branch={branch} onSaved={load} />
                  {pct !== null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-base' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              </div>

              <button type="button" onClick={() => setEditingPars(branch)} className={`${btnSecondary} mt-4 w-full`}>
                <TargetIcon className="h-4 w-4" />
                {branch.parCount > 0 ? `Estoque ideal · ${plural(branch.parCount, 'item', 'itens')}` : 'Definir estoque ideal'}
              </button>
            </li>
          )
        })}
      </ul>

      <ParEditorSheet
        branch={editingPars}
        branches={branches}
        onClose={() => setEditingPars(null)}
        onSaved={() => {
          setEditingPars(null)
          load()
        }}
      />
    </div>
  )
}
