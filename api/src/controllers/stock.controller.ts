import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma, StockMovementType } from '../generated/prisma/client'
import { trimOrNull, userIdOf } from '../lib/access'

const ITEM_INCLUDE = {
  category: true,
  packaging: true,
  supplier: { select: { id: true, name: true } },
} as const

const MOVEMENT_INCLUDE = {
  item: { select: { id: true, name: true, packaging: { select: { id: true, name: true } } } },
  purchase: { include: { supplier: { select: { id: true, name: true } } } },
  order: { include: { branch: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, name: true } },
} as const satisfies Prisma.StockMovementInclude

function signed(movement: { type: StockMovementType; quantity: number }) {
  return movement.type === StockMovementType.ENTRADA ? movement.quantity : -movement.quantity
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function listStockMovements(req: Request, res: Response) {
  const itemId = typeof req.query.itemId === 'string' && req.query.itemId ? req.query.itemId : null
  const type =
    req.query.type === StockMovementType.ENTRADA || req.query.type === StockMovementType.SAIDA ? req.query.type : null
  const from = parseDate(req.query.from)
  const to = parseDate(req.query.to)
  const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null
  const take = Math.min(Math.max(Number(req.query.take) || 50, 1), 200)

  const where: Prisma.StockMovementWhereInput = {
    ...(itemId ? { itemId } : {}),
    ...(type ? { type } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  }

  const rows = await prisma.stockMovement.findMany({
    where,
    include: MOVEMENT_INCLUDE,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const hasMore = rows.length > take
  const page = rows.slice(0, take)

  // Ficha do produto: saldo depois de cada movimentação = saldo atual menos tudo o que veio
  // depois dela. Com filtro de tipo a sequência fica com buracos, então o saldo não é calculado.
  const balanceById = new Map<string, number>()
  if (itemId && !type && page.length) {
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { stockQuantity: true } })
    const first = page[0]
    const newer = await prisma.stockMovement.findMany({
      where: {
        itemId,
        OR: [{ createdAt: { gt: first.createdAt } }, { createdAt: first.createdAt, id: { gt: first.id } }],
      },
      select: { type: true, quantity: true },
    })
    let balance = (item?.stockQuantity ?? 0) - newer.reduce((sum, m) => sum + signed(m), 0)
    for (const movement of page) {
      balanceById.set(movement.id, balance)
      balance -= signed(movement)
    }
  }

  res.json({
    movements: page.map((movement) => ({ ...movement, balanceAfter: balanceById.get(movement.id) ?? null })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  })
}

/**
 * Inventário: a pessoa informa quanto contou e o sistema lança a diferença como entrada ou
 * saída. Também marca a data da última contagem de cada produto.
 */
export async function createStockCount(req: Request, res: Response) {
  const { entries, reason } = req.body as {
    entries?: { itemId?: string; countedQuantity?: number }[]
    reason?: string
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um produto contado' })
    return
  }
  for (const entry of entries) {
    if (!entry.itemId || !Number.isInteger(entry.countedQuantity) || (entry.countedQuantity ?? -1) < 0) {
      res.status(400).json({ error: 'Cada produto precisa de itemId e da quantidade contada (inteiro >= 0)' })
      return
    }
  }
  const itemIds = entries.map((entry) => entry.itemId!)
  if (new Set(itemIds).size !== itemIds.length) {
    res.status(400).json({ error: 'O mesmo produto aparece mais de uma vez na contagem' })
    return
  }

  const label = trimOrNull(reason) ? `Inventário: ${trimOrNull(reason)}` : 'Inventário'
  const userId = userIdOf(req)
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const items = await tx.item.findMany({ where: { id: { in: itemIds } } })
    if (items.length !== itemIds.length) return null
    const itemById = new Map(items.map((item) => [item.id, item]))

    const adjustments: { itemId: string; previous: number; counted: number; difference: number }[] = []
    for (const entry of entries) {
      const item = itemById.get(entry.itemId!)!
      const counted = entry.countedQuantity!
      const difference = counted - item.stockQuantity
      if (difference !== 0) {
        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            type: difference > 0 ? StockMovementType.ENTRADA : StockMovementType.SAIDA,
            quantity: Math.abs(difference),
            reason: label,
            createdById: userId,
          },
        })
      }
      await tx.item.update({ where: { id: item.id }, data: { stockQuantity: counted, lastCountedAt: now } })
      adjustments.push({ itemId: item.id, previous: item.stockQuantity, counted, difference })
    }

    const updated = await tx.item.findMany({ where: { id: { in: itemIds } }, include: ITEM_INCLUDE })
    return { items: updated, adjustments }
  })

  if (!result) {
    res.status(400).json({ error: 'Um ou mais produtos informados não existem' })
    return
  }
  res.json(result)
}

/** Ajuste avulso (avaria, perda, doação...). Como no envio, a saída não confere o saldo. */
export async function createStockAdjustmentBatch(req: Request, res: Response) {
  const { entries, reason } = req.body as {
    entries?: { itemId?: string; type?: string; quantity?: number }[]
    reason?: string
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um item no ajuste' })
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
  const existingCount = await prisma.item.count({ where: { id: { in: itemIds } } })
  if (existingCount !== itemIds.length) {
    res.status(400).json({ error: 'Um ou mais produtos informados não existem' })
    return
  }

  const trimmedReason = trimOrNull(reason) ?? 'Ajuste de estoque'
  const userId = userIdOf(req)

  const updatedItems = await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      await tx.stockMovement.create({
        data: {
          itemId: entry.itemId!,
          type: entry.type as StockMovementType,
          quantity: entry.quantity!,
          reason: trimmedReason,
          createdById: userId,
        },
      })
      await tx.item.update({
        where: { id: entry.itemId! },
        data: {
          stockQuantity:
            entry.type === StockMovementType.ENTRADA ? { increment: entry.quantity! } : { decrement: entry.quantity! },
        },
      })
    }
    return tx.item.findMany({ where: { id: { in: itemIds } }, include: ITEM_INCLUDE })
  })

  res.json(updatedItems)
}
