import { useCallback, useEffect, useState } from 'react'
import type { Order } from '../types'

export function usePrintOrder() {
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!printingOrder) return

    function handleAfterPrint() {
      setPrintingOrder(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)
    const frameId = requestAnimationFrame(() => window.print())

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      cancelAnimationFrame(frameId)
    }
  }, [printingOrder])

  const printOrder = useCallback((order: Order) => setPrintingOrder(order), [])

  return { printingOrder, printOrder }
}
