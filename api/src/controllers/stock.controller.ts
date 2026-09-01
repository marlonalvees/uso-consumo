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

export async function createStockAdjustmentBatch(req: Request, res: Response) {
  const { entries, reason } = req.body as {
    entries?: { itemId?: string; type?: string; quantity?: number }[]
    reason?: string
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um item no balanço' })
    return
  }

  for (const entry of entries) {
    if (!entry.itemId) {
      res.status(400).json({ error: 'Informe o produto em todas as linhas' })
      return
    }
    if (entry.type !== StockMovementType.ENTRADA && entry.type !== StockMovementType.SAIDA) {
      res.status(400).json({ error: 'type deve ser ENTRADA ou SAIDA' })
      return
    }
    if (!Number.isInteger(entry.quantity) || (entry.quantity ?? 0) <= 0) {
      res.status(400).json({ error: 'quantity deve ser um inteiro maior que 0 em todas as linhas' })
      return
    }
  }

  const itemIds = [...new Set(entries.map((entry) => entry.itemId!))]
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } })
  if (items.length !== itemIds.length) {
    res.status(400).json({ error: 'Um ou mais produtos informados não existem' })
    return
  }
  const itemById = new Map(items.map((item) => [item.id, item]))

  const runningBalance = new Map(items.map((item) => [item.id, item.stockQuantity]))
  for (const entry of entries) {
    const current = runningBalance.get(entry.itemId!)!
    if (entry.type === StockMovementType.SAIDA) {
      if (entry.quantity! > current) {
        res.status(400).json({
          error: `Estoque insuficiente para "${itemById.get(entry.itemId!)!.name}" — atual: ${current}`,
        })
        return
      }
      runningBalance.set(entry.itemId!, current - entry.quantity!)
    } else {
      runningBalance.set(entry.itemId!, current + entry.quantity!)
    }
  }

  const trimmedReason = reason?.trim() || 'Balanço de estoque'

  const updatedItems = await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      await tx.stockMovement.create({
        data: {
          itemId: entry.itemId!,
          type: entry.type as StockMovementType,
          quantity: entry.quantity!,
          reason: trimmedReason,
        },
      })
      await tx.item.update({
        where: { id: entry.itemId! },
        data: {
          stockQuantity:
            entry.type === StockMovementType.ENTRADA
              ? { increment: entry.quantity! }
              : { decrement: entry.quantity! },
        },
      })
    }
    return tx.item.findMany({ where: { id: { in: itemIds } }, include: ITEM_INCLUDE })
  })

  res.json(updatedItems)
}
