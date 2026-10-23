import { useMemo } from 'react'
import { useOrders } from '../context/OrdersContext'

/** Contadores dos ícones do menu: pedidos novos (central) e pedidos em andamento (filial). */
export function useNavBadges(): { novos: number; ativos: number } {
  const { orders, activeOrders } = useOrders()
  return useMemo(
    () => ({
      novos: orders.filter((o) => o.status === 'RECEBIDO').length,
      ativos: activeOrders.length,
    }),
    [orders, activeOrders],
  )
}
