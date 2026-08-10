import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { Order } from '../types'
import { useAuth } from './AuthContext'

interface PendingOrdersContextValue {
  pendingCount: number
  refreshPendingCount: () => void
}

const PendingOrdersContext = createContext<PendingOrdersContextValue | undefined>(undefined)

export function PendingOrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = useCallback(() => {
    if (user?.role !== 'FILIAL') {
      setPendingCount(0)
      return
    }
    api
      .get<Order[]>('/orders')
      .then((orders) => setPendingCount(orders.filter((o) => o.status !== 'ENTREGUE').length))
      .catch(() => {})
  }, [user?.role])

  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  return (
    <PendingOrdersContext.Provider value={{ pendingCount, refreshPendingCount }}>
      {children}
    </PendingOrdersContext.Provider>
  )
}

export function usePendingOrders() {
  const ctx = useContext(PendingOrdersContext)
  if (!ctx) throw new Error('usePendingOrders deve ser usado dentro de PendingOrdersProvider')
  return ctx
}
