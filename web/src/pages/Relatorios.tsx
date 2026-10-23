import { useEffect, useState, type ReactNode } from 'react'
import { api, assetUrl } from '../lib/api'
import type { ConsumptionReport, DivergencesReport, ExtrasReport, IdleItemsReport, ServiceTimeReport } from '../types'
import { downloadCsv } from '../lib/csv'
import { formatCurrency, formatDate, formatHours, formatMonth } from '../lib/format'
import { RECEIPT_ISSUE_LABELS } from '../lib/orderStatus'
import { btnSecondary, cardClass, selectClass } from '../lib/ui'
import Tabs from '../components/ui/Tabs'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import { AlertIcon, ArchiveIcon, ChartIcon, ClockIcon, DownloadIcon, SparklesIcon } from '../components/icons'

type ReportTab = 'consumo' | 'atendimento' | 'divergencias' | 'extras' | 'parados'

function useReport<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    setData(null)
    api.get<T>(path).then(setData).catch(() => setData(null))
  }, [path])
  return data
}

function ReportCard({ title, description, actions, children }: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div>
          <h2 className="font-extrabold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${btnSecondary} py-2`}>
      <DownloadIcon className="h-4 w-4" /> Excel
    </button>
  )
}

const th = 'px-4 py-2.5 text-left text-xs font-bold text-gray-500'
const td = 'px-4 py-2.5'

function ConsumptionTab() {
  const [months, setMonths] = useState(6)
  const report = useReport<ConsumptionReport>(`/reports/consumption?months=${months}`)

  return (
    <ReportCard
      title="Consumo por filial"
      description="O que saiu da central, pelo custo do envio. Em vermelho: mês atual 30% acima da média."
      actions={
        <>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Meses" className={selectClass}>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
          {report && (
            <CsvButton
              onClick={() =>
                downloadCsv(
                  'consumo-por-filial',
                  ['Filial', ...report.months.map(formatMonth), 'Total'],
                  report.rows.map((row) => [row.branchName, ...report.months.map((m) => row.values[m]), row.total]),
                )
              }
            />
          )}
        </>
      }
    >
      {!report ? (
        <div className="p-4">
          <SkeletonCards count={3} className="h-10" />
        </div>
      ) : report.rows.length === 0 ? (
        <EmptyState icon={ChartIcon} title="Nada enviado no período" compact />
      ) : (
        <table className="w-full min-w-160 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Filial</th>
              {report.months.map((m) => (
                <th key={m} className={`${th} text-right capitalize`}>
                  {formatMonth(m)}
                </th>
              ))}
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.rows.map((row) => (
              <tr key={row.branchId}>
                <td className={`${td} font-semibold text-gray-900`}>
                  {row.branchName}
                  {row.aboveAverage && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Acima da média</span>}
                </td>
                {report.months.map((m, index) => (
                  <td
                    key={m}
                    className={`${td} text-right tabular-nums ${index === report.months.length - 1 && row.aboveAverage ? 'font-extrabold text-red-600' : 'text-gray-700'}`}
                  >
                    {row.values[m] ? formatCurrency(row.values[m]) : '—'}
                  </td>
                ))}
                <td className={`${td} text-right font-extrabold tabular-nums`}>{formatCurrency(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ReportCard>
  )
}

function ServiceTimeTab() {
  const [months, setMonths] = useState(3)
  const report = useReport<ServiceTimeReport>(`/reports/service-time?months=${months}`)

  return (
    <ReportCard
      title="Tempo de atendimento"
      description="Quanto a central leva do pedido ao envio, e a filial do envio à confirmação."
      actions={
        <>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Meses" className={selectClass}>
            <option value={1}>Este mês</option>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
          </select>
          {report && (
            <CsvButton
              onClick={() =>
                downloadCsv(
                  'tempo-de-atendimento',
                  ['Filial', 'Pedidos', 'Horas até o envio', 'Horas até a confirmação'],
                  report.rows.map((row) => [row.branchName, row.orders, row.avgHoursToShip, row.avgHoursToConfirm]),
                )
              }
            />
          )}
        </>
      }
    >
      {!report ? (
        <div className="p-4">
          <SkeletonCards count={3} className="h-10" />
        </div>
      ) : report.rows.length === 0 ? (
        <EmptyState icon={ClockIcon} title="Nenhum pedido enviado no período" compact />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-500">Pedidos enviados</p>
              <p className="text-xl font-extrabold tabular-nums">{report.overall.orders}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-500">Central: até o envio</p>
              <p className="text-xl font-extrabold tabular-nums">{formatHours(report.overall.avgHoursToShip)}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-500">Filial: até confirmar</p>
              <p className="text-xl font-extrabold tabular-nums">{formatHours(report.overall.avgHoursToConfirm)}</p>
            </div>
          </div>
          <table className="w-full min-w-120 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Filial</th>
                <th className={`${th} text-right`}>Pedidos</th>
                <th className={`${th} text-right`}>Até o envio</th>
                <th className={`${th} text-right`}>Até confirmar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.rows.map((row) => (
                <tr key={row.branchId}>
                  <td className={`${td} font-semibold text-gray-900`}>{row.branchName}</td>
                  <td className={`${td} text-right tabular-nums`}>{row.orders}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatHours(row.avgHoursToShip)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatHours(row.avgHoursToConfirm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ReportCard>
  )
}

function DivergencesTab() {
  const report = useReport<DivergencesReport>('/reports/divergences?months=3')
  return (
    <ReportCard
      title="Recebimentos com divergência"
      description="Pedidos em que a filial apontou falta ou avaria, nos últimos 3 meses."
      actions={
        report &&
        report.rows.length > 0 && (
          <CsvButton
            onClick={() =>
              downloadCsv(
                'divergencias',
                ['Data', 'Filial', 'Item', 'Enviado', 'Recebido', 'Problema', 'Observação'],
                report.rows.flatMap((row) =>
                  row.issues.map((issue) => [formatDate(row.deliveredAt), row.branch.name, issue.name, issue.sent, issue.received, issue.issue ? RECEIPT_ISSUE_LABELS[issue.issue] : '', row.receiptNotes]),
                ),
              )
            }
          />
        )
      }
    >
      {!report ? (
        <div className="p-4">
          <SkeletonCards count={2} className="h-16" />
        </div>
      ) : report.rows.length === 0 ? (
        <EmptyState icon={AlertIcon} title="Nenhuma divergência" description="Todos os recebimentos bateram com o que foi enviado." compact />
      ) : (
        <ul className="divide-y divide-gray-100">
          {report.rows.map((row) => (
            <li key={row.orderId} className="flex gap-3 p-4">
              {row.receiptPhotoPath && <img src={assetUrl(row.receiptPhotoPath)} alt="Foto do recebimento" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">
                  {row.branch.name} · {formatDate(row.deliveredAt)}
                </p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {row.issues.map((issue, index) => (
                    <li key={index} className="text-gray-700">
                      {issue.name}: chegou {issue.received ?? 0} de {issue.sent}{' '}
                      <span className="font-bold text-red-600">({issue.issue ? RECEIPT_ISSUE_LABELS[issue.issue] : ''})</span>
                    </li>
                  ))}
                </ul>
                {row.receiptNotes && <p className="mt-1 text-xs text-gray-500">“{row.receiptNotes}”</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ReportCard>
  )
}

function ExtrasTab() {
  const report = useReport<ExtrasReport>('/reports/extras?months=6')
  return (
    <ReportCard
      title="Itens extras mais pedidos"
      description="Pedidos fora do catálogo nos últimos 6 meses: os que se repetem são candidatos a virar produto."
      actions={
        report &&
        report.rows.length > 0 && (
          <CsvButton
            onClick={() =>
              downloadCsv('itens-extras', ['Item', 'Vezes pedido', 'Quantidade', 'Filiais', 'Último pedido'], report.rows.map((r) => [r.name, r.timesRequested, r.totalQuantity, r.branches, formatDate(r.lastRequestedAt)]))
            }
          />
        )
      }
    >
      {!report ? (
        <div className="p-4">
          <SkeletonCards count={3} className="h-10" />
        </div>
      ) : report.rows.length === 0 ? (
        <EmptyState icon={SparklesIcon} title="Nenhum item extra pedido" compact />
      ) : (
        <table className="w-full min-w-120 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Item</th>
              <th className={`${th} text-right`}>Vezes</th>
              <th className={`${th} text-right`}>Quantidade</th>
              <th className={`${th} text-right`}>Filiais</th>
              <th className={th}>Último</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.rows.map((row) => (
              <tr key={row.name}>
                <td className={`${td} font-semibold text-gray-900`}>
                  {row.name}
                  {row.timesRequested >= 3 && <span className="ml-2 rounded-full bg-orange-base/10 px-2 py-0.5 text-[11px] font-bold text-orange-base">Cadastrar?</span>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{row.timesRequested}</td>
                <td className={`${td} text-right tabular-nums`}>{row.totalQuantity}</td>
                <td className={`${td} text-right tabular-nums`}>{row.branches}</td>
                <td className={`${td} text-gray-600`}>{formatDate(row.lastRequestedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ReportCard>
  )
}

function IdleItemsTab() {
  const [days, setDays] = useState(90)
  const report = useReport<IdleItemsReport>(`/reports/idle-items?days=${days}`)
  const total = report?.rows.reduce((sum, row) => sum + row.stockValue, 0) ?? 0

  return (
    <ReportCard
      title="Itens parados"
      description={`Produtos com estoque que não saíram nenhuma vez no período${report ? ` · ${formatCurrency(total)} parados` : ''}.`}
      actions={
        <>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Dias sem saída" className={selectClass}>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>180 dias</option>
          </select>
          {report && report.rows.length > 0 && (
            <CsvButton
              onClick={() =>
                downloadCsv(
                  'itens-parados',
                  ['Produto', 'Estoque', 'Valor parado', 'Última saída'],
                  report.rows.map((row) => [row.item.name, row.item.stockQuantity, row.stockValue, row.lastOutAt ? formatDate(row.lastOutAt) : 'Nunca']),
                )
              }
            />
          )}
        </>
      }
    >
      {!report ? (
        <div className="p-4">
          <SkeletonCards count={3} className="h-10" />
        </div>
      ) : report.rows.length === 0 ? (
        <EmptyState icon={ArchiveIcon} title="Nenhum item parado" description="Tudo o que tem estoque saiu no período." compact />
      ) : (
        <table className="w-full min-w-120 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Produto</th>
              <th className={`${th} text-right`}>Estoque</th>
              <th className={`${th} text-right`}>Valor parado</th>
              <th className={th}>Última saída</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.rows.map((row) => (
              <tr key={row.item.id}>
                <td className={`${td} font-semibold text-gray-900`}>{row.item.name}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {row.item.stockQuantity} {row.item.packaging.name}
                </td>
                <td className={`${td} text-right font-bold tabular-nums`}>{formatCurrency(row.stockValue)}</td>
                <td className={`${td} text-gray-600`}>{row.lastOutAt ? formatDate(row.lastOutAt) : 'Nunca saiu'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ReportCard>
  )
}

export default function Relatorios() {
  const [tab, setTab] = useState<ReportTab>('consumo')
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900">Relatórios</h1>
      <p className="mb-4 text-sm text-gray-500">Perguntas que a central faz todo mês, com exportação para Excel.</p>
      <Tabs
        variant="underline"
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'consumo', label: 'Consumo' },
          { value: 'atendimento', label: 'Atendimento' },
          { value: 'divergencias', label: 'Divergências' },
          { value: 'extras', label: 'Itens extras' },
          { value: 'parados', label: 'Itens parados' },
        ]}
      />
      {tab === 'consumo' && <ConsumptionTab />}
      {tab === 'atendimento' && <ServiceTimeTab />}
      {tab === 'divergencias' && <DivergencesTab />}
      {tab === 'extras' && <ExtrasTab />}
      {tab === 'parados' && <IdleItemsTab />}
    </div>
  )
}
