import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

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
