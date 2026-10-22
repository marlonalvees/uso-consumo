import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { Order } from '../types'
import { useAuth } from './AuthContext'

interface OrdersContextValue {
  orders: Order[]
  loadingOrders: boolean
  pendingCount: number
  myActiveOrder: Order | null
  refreshOrders: () => Promise<void>
  addOrder: (order: Order) => void
  updateOrder: (order: Order) => void
}

const ORDERS_POLL_MS = 30_000

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  const refreshOrders = useCallback(async () => {
    if (!user) {
      setOrders([])
      setLoadingOrders(false)
      return
    }
    try {
      const data = await api.get<Order[]>('/orders')
      setOrders(data)
    } catch {
      // mantém os pedidos já carregados em caso de falha na atualização
    } finally {
      setLoadingOrders(false)
    }
  }, [user])

  useEffect(() => {
    refreshOrders()
  }, [refreshOrders])

  // mantém os avisos de pedido (barra do topo) atualizados sem precisar recarregar a página
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      if (!document.hidden) refreshOrders()
    }, ORDERS_POLL_MS)
    return () => clearInterval(id)
  }, [user, refreshOrders])

  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev])
  }, [])

  const updateOrder = useCallback((order: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)))
  }, [])

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status !== 'ENTREGUE').length,
    [orders],
  )

  // a trava de um pedido em aberto por vez vale só pro supervisor (o admin faz pedidos pra várias filiais)
  const myActiveOrder = useMemo(
    () =>
      user?.isAdmin
        ? null
        : (orders.find((o) => o.requestedBy.id === user?.id && o.status !== 'ENTREGUE') ?? null),
    [orders, user],
  )

  return (
    <OrdersContext.Provider
      value={{ orders, loadingOrders, pendingCount, myActiveOrder, refreshOrders, addOrder, updateOrder }}
    >
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders deve ser usado dentro de OrdersProvider')
  return ctx
}
