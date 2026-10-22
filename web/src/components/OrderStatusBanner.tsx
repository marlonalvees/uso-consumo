import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import type { OrderStatus } from '../types'
import { ChevronRightIcon, ClipboardIcon, PackageSearchIcon, TruckIcon } from './icons'

type BannerStatus = Exclude<OrderStatus, 'ENTREGUE'>

const BANNER_STATUSES: BannerStatus[] = ['RECEBIDO', 'EM_ANDAMENTO', 'ENVIADO']

// Recebido pisca até a central passar o pedido pra "Em andamento"
const BANNER_STYLES: Record<BannerStatus, string> = {
  RECEBIDO: 'bg-linear-to-r from-red-base to-red-light text-white shadow-red-base/30 motion-safe:animate-blink',
  EM_ANDAMENTO: 'bg-linear-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-amber-500/30',
  ENVIADO: 'bg-linear-to-r from-blue-700 to-blue-500 text-white shadow-blue-600/30',
}

// mesmos ícones da linha do tempo do pedido (OrderStatusTimeline)
const BANNER_ICONS: Record<BannerStatus, ComponentType<{ className?: string }>> = {
  RECEBIDO: ClipboardIcon,
  EM_ANDAMENTO: PackageSearchIcon,
  ENVIADO: TruckIcon,
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const ADMIN_MESSAGES: Record<BannerStatus, (count: number) => string> = {
  RECEBIDO: (count) => `${plural(count, 'pedido novo', 'pedidos novos')} aguardando a separação`,
  EM_ANDAMENTO: (count) => `${plural(count, 'pedido', 'pedidos')} em andamento`,
  ENVIADO: (count) =>
    `${plural(count, 'pedido enviado', 'pedidos enviados')} aguardando a confirmação da filial`,
}

interface Banner {
  status: BannerStatus
  message: ReactNode
  actionLabel: string
  to: string
  // lido pela página de destino pra abrir a aba certa e destacar o(s) pedido(s) (useNavigationFocus)
  state: Record<string, unknown>
}

export default function OrderStatusBanner() {
  const { user } = useAuth()
  const { orders, myActiveOrder } = useOrders()

  const banners: Banner[] = []

  if (user?.isAdmin) {
    for (const status of BANNER_STATUSES) {
      const count = orders.filter((o) => o.status === status).length
      if (count === 0) continue
      banners.push({
        status,
        message: ADMIN_MESSAGES[status](count),
        actionLabel: count === 1 ? 'Ver pedido' : 'Ver pedidos',
        to: '/administracao',
        state: { tab: 'pedidos', focusStatus: status },
      })
    }
  } else if (myActiveOrder && myActiveOrder.status !== 'ENTREGUE') {
    const branch = <strong>{myActiveOrder.branch.name}</strong>
    const messages: Record<BannerStatus, ReactNode> = {
      RECEBIDO: <>Pedido da filial {branch} recebido, aguardando a central iniciar a separação</>,
      EM_ANDAMENTO: <>Pedido da filial {branch} em andamento: a central está separando os itens</>,
      ENVIADO: <>Pedido da filial {branch} enviado. Confirme o recebimento quando chegar</>,
    }
    banners.push({
      status: myActiveOrder.status,
      message: messages[myActiveOrder.status],
      actionLabel: 'Ver pedido',
      to: '/pedidos',
      state: { tab: 'meus', branchId: myActiveOrder.branchId, focusOrderId: myActiveOrder.id },
    })
  }

  if (banners.length === 0) return null

  return (
    <div role="status" className="mb-4 flex flex-col gap-2 print:hidden">
      {banners.map((banner, index) => {
        const Icon = BANNER_ICONS[banner.status]
        return (
          <Link
            key={banner.status}
            to={banner.to}
            state={banner.state}
            className={`group relative block overflow-hidden rounded-xl px-3 py-2 text-sm font-medium shadow-md ring-1 ring-black/5 ring-inset transition hover:shadow-lg hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-novamix-teal ${BANNER_STYLES[banner.status]}`}
          >
            {/* brilho que atravessa a barra a cada 15s; o atraso escalona as barras uma depois da outra */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-110 from-transparent from-40% via-white/50 to-transparent to-60% motion-safe:animate-shine motion-reduce:hidden"
              style={{ animationDelay: `${index * 300}ms` }}
            />
            <span className="relative flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/25">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">{banner.message}</span>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-white/20 p-1 font-semibold transition-colors group-hover:bg-white/30 sm:pr-2 sm:pl-3">
                <span className="hidden sm:inline">{banner.actionLabel}</span>
                <ChevronRightIcon className="h-4 w-4" />
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
