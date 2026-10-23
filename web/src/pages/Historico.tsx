import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Order, OrderStatus } from '../types'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import { useOrderEvents } from '../hooks/useOrderEvents'
import { usePrintOrder } from '../hooks/usePrintOrder'
import { DATE_PRESET_OPTIONS, matchesDatePreset, type DatePreset } from '../lib/dateFilter'
import { normalizeText } from '../lib/text'
import { formatCurrency, formatDate, orderCode, plural } from '../lib/format'
import { btnPrimary, btnSecondary, cardClass, inputClass, selectClass } from '../lib/ui'
import { StatusPill } from '../components/ui/StatusPill'
import Tabs from '../components/ui/Tabs'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import OrderItemsList from '../components/orders/OrderItemsList'
import OrderTimeline from '../components/orders/OrderTimeline'
import OrderPrintSheet from '../components/OrderPrintSheet'
import { ChevronDownIcon, HistoryIcon, NoteIcon, PrinterIcon, RepeatIcon, SearchIcon } from '../components/icons'

type StatusFilter = 'todos' | 'andamento' | 'ENTREGUE' | 'CANCELADO'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'andamento', label: 'Em andamento' },
  { value: 'ENTREGUE', label: 'Entregues' },
  { value: 'CANCELADO', label: 'Cancelados' },
]

const IN_PROGRESS: OrderStatus[] = ['RECEBIDO', 'EM_ANDAMENTO', 'ENVIADO']

function orderValue(order: Order) {
  return order.items.reduce((sum, oi) => sum + oi.quantity * (oi.unitCost ?? oi.item.price), 0)
}

function monthLabel(iso: string) {
  const label = new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function HistoryCard({ order, onRepeat, onPrint }: { order: Order; onRepeat: () => void; onPrint: () => void }) {
  const [open, setOpen] = useState(false)
  const events = useOrderEvents(open ? order : null)
  const itemCount = order.items.filter((i) => i.requestedQuantity > 0 || i.quantity > 0).length + order.extraItems.length
  const value = orderValue(order)
  const hadIssue = [...order.items, ...order.extraItems].some((line) => line.receiptIssue)

  return (
    <li className={`${cardClass} overflow-hidden`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="press flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={order.status} />
            {hadIssue && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Com divergência</span>}
          </div>
          <p className="mt-1.5 truncate text-sm font-bold text-gray-900">
            {order.branch.name} · {formatDate(order.createdAt)}
          </p>
          <p className="text-xs text-gray-500">
            {orderCode(order)} · {plural(itemCount, 'item', 'itens')} · {order.requestedBy.name}
            {value > 0 && ` · ${formatCurrency(value)}`}
          </p>
        </div>
        <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-fade-in border-t border-gray-100 px-4 pb-4">
          {order.status === 'CANCELADO' && order.cancelReason && (
            <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <strong>Motivo do cancelamento:</strong> {order.cancelReason}
            </p>
          )}
          {order.adminNotes && (
            <p className="mt-3 flex gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <NoteIcon className="mt-0.5 h-4 w-4 shrink-0" /> <span><strong>Central:</strong> {order.adminNotes}</span>
            </p>
          )}
          {order.receiptNotes && (
            <p className="mt-3 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
              <NoteIcon className="mt-0.5 h-4 w-4 shrink-0" /> <span><strong>Recebimento:</strong> {order.receiptNotes}</span>
            </p>
          )}
          <OrderItemsList order={order} />
          <div className="mt-3">
            <OrderTimeline events={events} />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onRepeat} className={`${btnPrimary} flex-1`}>
              <RepeatIcon className="h-4 w-4" /> Pedir de novo
            </button>
            <button type="button" onClick={onPrint} className={btnSecondary} aria-label="Imprimir pedido">
              <PrinterIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Histórico de pedidos da filial (as antigas abas "recentes" e "meus" juntas). */
export default function Historico() {
  const { user } = useAuth()
  const { orders, loadingOrders } = useOrders()
  const navigate = useNavigate()
  const { printingOrder, printOrder } = usePrintOrder()
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [onlyMine, setOnlyMine] = useState(false)
  const [branchId, setBranchId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('todos')

  const filtered = useMemo(() => {
    const term = normalizeText(search)
    return orders.filter((order) => {
      if (status === 'andamento' && !IN_PROGRESS.includes(order.status)) return false
      if ((status === 'ENTREGUE' || status === 'CANCELADO') && order.status !== status) return false
      if (onlyMine && order.requestedBy.id !== user?.id) return false
      if (branchId && order.branchId !== branchId) return false
      if (!matchesDatePreset(order.createdAt, datePreset, '', '')) return false
      if (term) {
        const hit =
          order.items.some((oi) => normalizeText(oi.item.name).includes(term)) ||
          order.extraItems.some((e) => normalizeText(e.name).includes(term))
        if (!hit) return false
      }
      return true
    })
  }, [orders, status, onlyMine, branchId, search, datePreset, user])

  const groups = useMemo(() => {
    const result: { key: string; label: string; orders: Order[] }[] = []
    for (const order of filtered) {
      const key = order.createdAt.slice(0, 7)
      const last = result[result.length - 1]
      if (last?.key === key) last.orders.push(order)
      else result.push({ key, label: monthLabel(order.createdAt), orders: [order] })
    }
    return result
  }, [filtered])

  const branches = user?.branches ?? []

  return (
    <div>
      <div className="print:hidden">
        <h1 className="mb-1 text-2xl font-extrabold text-gray-900">Histórico</h1>
        <p className="mb-5 text-sm text-gray-500">Todos os pedidos da filial, do mais novo para o mais antigo.</p>

        <div className="mb-4 space-y-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por item pedido"
              aria-label="Buscar por item pedido"
              className={`${inputClass} pl-10`}
            />
          </div>
          <Tabs tabs={STATUS_TABS} value={status} onChange={setStatus} />
          <div className="flex flex-wrap items-center gap-2">
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)} aria-label="Período" className={selectClass}>
              {DATE_PRESET_OPTIONS.filter((o) => o.value !== 'periodo').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === 'todos' ? 'Qualquer data' : option.label}
                </option>
              ))}
            </select>
            {branches.length > 1 && (
              <select value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')} aria-label="Filial" className={selectClass}>
                <option value="">Todas as filiais</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            <label className="press flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 ring-1 ring-gray-200">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="h-4 w-4 accent-orange-base" />
              Só os meus
            </label>
          </div>
        </div>

        {loadingOrders ? (
          <SkeletonCards count={4} />
        ) : groups.length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={HistoryIcon} title="Nenhum pedido encontrado" description="Mude os filtros ou faça o primeiro pedido." />
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-2 text-sm font-extrabold text-gray-500">
                  {group.label} · {plural(group.orders.length, 'pedido', 'pedidos')}
                </h2>
                <ul className="space-y-3">
                  {group.orders.map((order) => (
                    <HistoryCard
                      key={order.id}
                      order={order}
                      onPrint={() => printOrder(order)}
                      onRepeat={() => navigate('/pedidos', { state: { repeatOrderId: order.id } })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      <div className="hidden print:block">{printingOrder && <OrderPrintSheet order={printingOrder} />}</div>
    </div>
  )
}
