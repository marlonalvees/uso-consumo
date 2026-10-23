import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { BranchPar, BranchSummary, PendingItem } from '../types'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatShortDate } from '../lib/format'
import { btnPrimary, cardClass, sectionTitle } from '../lib/ui'
import Tabs from '../components/ui/Tabs'
import EmptyState from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import PushToggle from '../components/PushToggle'
import { AlertIcon, BagIcon, ClipboardCheckIcon, LogOutIcon, TargetIcon, WalletIcon } from '../components/icons'

/** Resumo da filial: consumo do mês x cota, pendências e estoque ideal. */
export default function MinhaFilial() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const branches = user?.branches ?? []
  const [branchId, setBranchId] = useState<number | null>(branches[0]?.id ?? null)
  const [summary, setSummary] = useState<BranchSummary | null>(null)
  const [pending, setPending] = useState<PendingItem[] | null>(null)
  const [pars, setPars] = useState<BranchPar[] | null>(null)

  useEffect(() => {
    if (!branchId) return
    setSummary(null)
    setPending(null)
    setPars(null)
    api.get<BranchSummary>(`/branches/${branchId}/summary`).then(setSummary).catch(() => {})
    api.get<PendingItem[]>(`/orders/pending-items?branchId=${branchId}`).then(setPending).catch(() => setPending([]))
    api.get<BranchPar[]>(`/branches/${branchId}/pars`).then(setPars).catch(() => setPars([]))
  }, [branchId])

  if (!branchId) {
    return <EmptyState icon={AlertIcon} title="Nenhuma filial liberada" description="Fale com o administrador do hub." />
  }

  const budget = summary?.monthlyBudget ?? null
  const pct = budget && summary ? Math.min(100, (summary.monthConsumption / budget) * 100) : 0
  const comparison =
    summary && summary.lastMonthsAverage > 0 ? (summary.monthConsumption / summary.lastMonthsAverage - 1) * 100 : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Minha filial</h1>
        <p className="text-sm text-gray-500">Consumo do mês, pendências e o estoque ideal combinado com a central.</p>
      </div>

      {branches.length > 1 && (
        <Tabs tabs={branches.map((b) => ({ value: String(b.id), label: b.name }))} value={String(branchId)} onChange={(v) => setBranchId(Number(v))} />
      )}

      <section className={`${cardClass} p-5`}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <WalletIcon className="h-5 w-5" />
          </span>
          <div>
            <p className={sectionTitle}>Consumo do mês</p>
            {summary ? (
              <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{formatCurrency(summary.monthConsumption)}</p>
            ) : (
              <Skeleton className="mt-1 h-7 w-32" />
            )}
          </div>
        </div>
        {summary && (
          <div className="mt-4 space-y-2 text-sm">
            {budget !== null ? (
              <>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-base' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-gray-600">
                  {formatCurrency(summary.monthConsumption)} de {formatCurrency(budget)} da cota ({Math.round(pct)}%)
                </p>
              </>
            ) : (
              <p className="text-gray-500">A central ainda não definiu uma cota mensal para esta filial.</p>
            )}
            {comparison !== null && (
              <p className={comparison > 30 ? 'font-semibold text-red-600' : 'text-gray-500'}>
                {comparison >= 0 ? `${Math.round(comparison)}% acima` : `${Math.round(-comparison)}% abaixo`} da média dos últimos 3 meses (
                {formatCurrency(summary.lastMonthsAverage)})
              </p>
            )}
          </div>
        )}
      </section>

      <section className={`${cardClass} p-5`}>
        <p className={`${sectionTitle} mb-3`}>Pendências</p>
        {pending === null ? (
          <Skeleton className="h-16 w-full" />
        ) : pending.length === 0 ? (
          <EmptyState icon={ClipboardCheckIcon} title="Nenhuma pendência" description="Nada cortado ou faltando nos últimos pedidos." compact />
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {p.quantity}× {p.item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.cutQuantity > 0 ? 'Cortado pela central' : p.receiptIssue === 'AVARIADO' ? 'Chegou avariado' : 'Faltou na entrega'} · pedido de{' '}
                      {formatShortDate(p.orderCreatedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => navigate('/pedidos')} className={`${btnPrimary} mt-4 w-full`}>
              <BagIcon className="h-4 w-4" /> Pedir as pendências
            </button>
          </>
        )}
      </section>

      <section className={`${cardClass} p-5`}>
        <p className={`${sectionTitle} mb-3`}>Estoque ideal da filial</p>
        {pars === null ? (
          <Skeleton className="h-16 w-full" />
        ) : pars.length === 0 ? (
          <EmptyState
            icon={TargetIcon}
            title="Ainda não definido"
            description="A central combina com a filial quanto ter de cada item. Aí o pedido pode ser calculado sozinho."
            compact
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {pars.map((par) => (
              <li key={par.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="truncate text-sm font-semibold text-gray-800">{par.item.name}</span>
                <span className="shrink-0 text-sm font-extrabold text-gray-900 tabular-nums">
                  {par.quantity} <span className="text-xs font-semibold text-gray-500">{par.item.packaging.name}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 lg:hidden">
        <PushToggle />
        <a
          href={import.meta.env.VITE_HUB_URL}
          className="press flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
        >
          <LogOutIcon className="h-4 w-4" /> Voltar ao hub
        </a>
      </section>
    </div>
  )
}
