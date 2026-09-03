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

  const myActiveOrder = useMemo(
    () => orders.find((o) => o.requestedBy.id === user?.id && o.status !== 'ENTREGUE') ?? null,
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
