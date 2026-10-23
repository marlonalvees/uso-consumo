import { prisma } from './prisma'
import { OrderStatus } from '../generated/prisma/client'

const PENDING_WINDOW_DAYS = 90

/**
 * Pendências de uma ou mais filiais: o que a central cortou de um pedido já enviado e o que
 * faltou ou chegou avariado no recebimento. Somem quando a filial reaproveita num pedido
 * novo ou dispensa.
 */
export async function listPendingItems(branchIds?: number[]) {
  const since = new Date(Date.now() - PENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const rows = await prisma.orderItem.findMany({
    where: {
      pendingResolvedAt: null,
      item: { active: true },
      order: {
        status: { in: [OrderStatus.ENVIADO, OrderStatus.ENTREGUE] },
        createdAt: { gte: since },
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
    },
    include: {
      item: { include: { category: true, packaging: true } },
      order: { select: { id: true, branchId: true, createdAt: true, status: true } },
    },
    orderBy: { order: { createdAt: 'desc' } },
  })

  return rows
    .map((row) => {
      const cutQuantity = Math.max(0, row.requestedQuantity - row.quantity)
      const missingQuantity = row.receivedQuantity === null ? 0 : Math.max(0, row.quantity - row.receivedQuantity)
      return {
        id: row.id,
        orderId: row.order.id,
        orderCreatedAt: row.order.createdAt,
        branchId: row.order.branchId,
        item: row.item,
        cutQuantity,
        missingQuantity,
        quantity: cutQuantity + missingQuantity,
        receiptIssue: row.receiptIssue,
        adjustReason: row.adjustReason,
      }
    })
    .filter((pending) => pending.quantity > 0)
}
