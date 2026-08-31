import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { StockMovementType } from '../generated/prisma/client'

const ITEM_INCLUDE = {
  category: true,
  packaging: true,
  supplier: { select: { id: true, name: true } },
} as const

export async function listStockMovements(_req: Request, res: Response) {
  const movements = await prisma.stockMovement.findMany({
    include: {
      item: { select: { id: true, name: true, packaging: { select: { id: true, name: true } } } },
      purchase: { include: { supplier: { select: { id: true, name: true } } } },
      order: { include: { branch: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(movements)
}

export async function createStockAdjustment(req: Request, res: Response) {
  const { itemId, type, quantity, reason } = req.body as {
    itemId?: string
    type?: string
    quantity?: number
    reason?: string
  }

  if (!itemId) {
    res.status(400).json({ error: 'Informe o produto' })
    return
  }
  if (type !== StockMovementType.ENTRADA && type !== StockMovementType.SAIDA) {
    res.status(400).json({ error: 'type deve ser ENTRADA ou SAIDA' })
    return
  }
  if (!Number.isInteger(quantity) || (quantity ?? 0) <= 0) {
    res.status(400).json({ error: 'quantity deve ser um inteiro maior que 0' })
    return
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } })
  if (!item) {
    res.status(404).json({ error: 'Produto não encontrado' })
    return
  }
  if (type === StockMovementType.SAIDA && quantity! > item.stockQuantity) {
    res.status(400).json({ error: `Estoque insuficiente — atual: ${item.stockQuantity}` })
    return
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: {
        itemId,
        type,
        quantity: quantity!,
        reason: reason?.trim() || 'Balanço de estoque',
      },
    })
    return tx.item.update({
      where: { id: itemId },
      data: {
        stockQuantity:
          type === StockMovementType.ENTRADA ? { increment: quantity! } : { decrement: quantity! },
      },
      include: ITEM_INCLUDE,
    })
  })

  res.json(updated)
}
