import { prisma } from './prisma'
import { OrderStatus } from '../generated/prisma/client'

/** Itens enviados às filiais no período (pela data de envio), com o custo guardado no envio. */
export function shippedOrderItems(from: Date, to: Date | null, branchIds?: number[]) {
  return prisma.orderItem.findMany({
    where: {
      quantity: { gt: 0 },
      order: {
        status: { in: [OrderStatus.ENVIADO, OrderStatus.ENTREGUE] },
        sentAt: { gte: from, ...(to ? { lt: to } : {}) },
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
    },
    select: {
      quantity: true,
      unitCost: true,
      item: { select: { price: true } },
      order: { select: { branchId: true, sentAt: true } },
    },
  })
}

export type ShippedLine = Awaited<ReturnType<typeof shippedOrderItems>>[number]

// pedidos de antes da migration podem não ter custo guardado: usa o custo atual do produto
export function lineValue(line: ShippedLine): number {
  return line.quantity * (line.unitCost ?? line.item.price)
}

export function sumByBranch(lines: ShippedLine[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const line of lines) totals.set(line.order.branchId, (totals.get(line.order.branchId) ?? 0) + lineValue(line))
  return totals
}
