import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { Order } from '../types'
import { ACTIVE_STATUSES, OPEN_STATUSES } from '../lib/orderStatus'
import { useAuth } from './AuthContext'

const ORDERS_POLL_MS = 30_000

interface OrdersContextValue {
  orders: Order[]
  loadingOrders: boolean
  /** busca só o que mudou desde a última atualização */
  refreshOrders: () => Promise<void>
  addOrder: (order: Order) => void
  updateOrder: (order: Order) => void
  /** supervisor: pedidos das filiais dele que ainda não terminaram (admin: vazio) */
  activeOrders: Order[]
  /** pedido que a central ainda não enviou (Recebido/Em separação) da filial */
  openOrderFor: (branchId: number) => Order | undefined
  /** pedidos que chegaram desde a última atualização (pra central tocar o som de pedido novo) */
  newOrderIds: string[]
}

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined)

function sortByCreatedAt(orders: Order[]) {
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function latestUpdate(orders: Order[], current: string | null) {
  return orders.reduce<string | null>((max, o) => (!max || o.updatedAt > max ? o.updatedAt : max), current)
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [newOrderIds, setNewOrderIds] = useState<string[]>([])
  const lastSync = useRef<string | null>(null)
  const knownIds = useRef<Set<string>>(new Set())

  const loadAll = useCallback(async () => {
    if (!user) {
      setOrders([])
      setLoadingOrders(false)
      return
    }
    try {
      const data = await api.get<Order[]>('/orders')
      knownIds.current = new Set(data.map((o) => o.id))
      lastSync.current = latestUpdate(data, null)
      setOrders(data)
    } catch {
      // mantém os pedidos já carregados em caso de falha
    } finally {
      setLoadingOrders(false)
    }
  }, [user])

  const refreshOrders = useCallback(async () => {
    if (!user) return
    if (!lastSync.current) return loadAll()
    try {
      const changed = await api.get<Order[]>(`/orders?updatedSince=${encodeURIComponent(lastSync.current)}`)
      if (changed.length === 0) return
      const fresh = changed.filter((o) => !knownIds.current.has(o.id)).map((o) => o.id)
      for (const id of fresh) knownIds.current.add(id)
      lastSync.current = latestUpdate(changed, lastSync.current)
      setOrders((prev) => {
        const byId = new Map(prev.map((o) => [o.id, o]))
        for (const order of changed) byId.set(order.id, order)
        return sortByCreatedAt([...byId.values()])
      })
      if (fresh.length) setNewOrderIds(fresh)
    } catch {
      // tenta de novo no próximo ciclo
    }
  }, [user, loadAll])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // mantém os avisos e o quadro atualizados sem recarregar a página
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      if (!document.hidden) refreshOrders()
    }, ORDERS_POLL_MS)
    function handleVisible() {
      if (!document.hidden) refreshOrders()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [user, refreshOrders])

  const addOrder = useCallback((order: Order) => {
    knownIds.current.add(order.id)
    setOrders((prev) => sortByCreatedAt([order, ...prev.filter((o) => o.id !== order.id)]))
  }, [])

  const updateOrder = useCallback((order: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)))
  }, [])

  const activeOrders = useMemo(
    () => (user?.isAdmin ? [] : orders.filter((o) => ACTIVE_STATUSES.includes(o.status))),
    [orders, user],
  )

  const openOrderFor = useCallback(
    (branchId: number) => orders.find((o) => o.branchId === branchId && OPEN_STATUSES.includes(o.status)),
    [orders],
  )

  return (
    <OrdersContext.Provider
      value={{ orders, loadingOrders, refreshOrders, addOrder, updateOrder, activeOrders, openOrderFor, newOrderIds }}
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
