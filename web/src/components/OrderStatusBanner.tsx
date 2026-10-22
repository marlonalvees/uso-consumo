import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import type { OrderStatus } from '../types'

type BannerStatus = Exclude<OrderStatus, 'ENTREGUE'>

const BANNER_STATUSES: BannerStatus[] = ['RECEBIDO', 'EM_ANDAMENTO', 'ENVIADO']

// Recebido pisca até a central passar o pedido pra "Em andamento"
const BANNER_STYLES: Record<BannerStatus, string> = {
  RECEBIDO: 'bg-red-base text-white motion-safe:animate-blink',
  EM_ANDAMENTO: 'bg-amber-300 text-amber-950',
  ENVIADO: 'bg-blue-600 text-white',
}

interface Banner {
  status: BannerStatus
  message: ReactNode
  link?: { to: string; label: string; state?: unknown }
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export default function OrderStatusBanner() {
  const { user } = useAuth()
  const { orders, myActiveOrder } = useOrders()

  const banners: Banner[] = []

  if (user?.isAdmin) {
    const counts = Object.fromEntries(
      BANNER_STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]),
    ) as Record<BannerStatus, number>

    if (counts.RECEBIDO > 0) {
      banners.push({
        status: 'RECEBIDO',
        message: `${plural(counts.RECEBIDO, 'pedido novo', 'pedidos novos')} aguardando a separação`,
        link: { to: '/administracao', label: 'Ver pedidos' },
      })
    }
    if (counts.EM_ANDAMENTO > 0) {
      banners.push({
        status: 'EM_ANDAMENTO',
        message: `${plural(counts.EM_ANDAMENTO, 'pedido', 'pedidos')} em andamento`,
      })
    }
    if (counts.ENVIADO > 0) {
      banners.push({
        status: 'ENVIADO',
        message: `${plural(counts.ENVIADO, 'pedido enviado', 'pedidos enviados')} aguardando a confirmação da filial`,
      })
    }
  } else if (myActiveOrder && myActiveOrder.status !== 'ENTREGUE') {
    const branch = <strong>{myActiveOrder.branch.name}</strong>
    const meusPedidos = { to: '/pedidos', label: 'Ver meus pedidos', state: { tab: 'meus' } }
    const messages: Record<BannerStatus, ReactNode> = {
      RECEBIDO: <>Pedido da filial {branch} recebido, aguardando a central iniciar a separação</>,
      EM_ANDAMENTO: <>Pedido da filial {branch} em andamento: a central está separando os itens</>,
      ENVIADO: <>Pedido da filial {branch} enviado. Confirme o recebimento quando chegar</>,
    }
    banners.push({
      status: myActiveOrder.status,
      message: messages[myActiveOrder.status],
      link: myActiveOrder.status === 'ENVIADO' ? meusPedidos : undefined,
    })
  }

  if (banners.length === 0) return null

  return (
    <div className="mb-4 flex flex-col gap-2 print:hidden">
      {banners.map((banner) => (
        <div
          key={banner.status}
          role="status"
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-4 py-2 text-sm font-medium shadow-sm ${BANNER_STYLES[banner.status]}`}
        >
          <span>{banner.message}</span>
          {banner.link && (
            <Link
              to={banner.link.to}
              state={banner.link.state}
              className="font-semibold whitespace-nowrap underline underline-offset-2"
            >
              {banner.link.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
