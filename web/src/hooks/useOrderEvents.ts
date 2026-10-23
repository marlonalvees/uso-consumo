import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Order, OrderEvent } from '../types'

const cache = new Map<string, { updatedAt: string; events: OrderEvent[] }>()

/** Histórico do pedido, buscado sob demanda e guardado até o pedido mudar de novo. */
export function useOrderEvents(order: Pick<Order, 'id' | 'updatedAt'> | null) {
  const cached = order ? cache.get(order.id) : undefined
  const fresh = cached && order && cached.updatedAt === order.updatedAt
  const [events, setEvents] = useState<OrderEvent[] | null>(fresh ? cached.events : null)

  useEffect(() => {
    if (!order) return
    const hit = cache.get(order.id)
    if (hit && hit.updatedAt === order.updatedAt) {
      setEvents(hit.events)
      return
    }
    let cancelled = false
    api
      .get<OrderEvent[]>(`/orders/${order.id}/events`)
      .then((data) => {
        cache.set(order.id, { updatedAt: order.updatedAt, events: data })
        if (!cancelled) setEvents(data)
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [order?.id, order?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  return events
}
