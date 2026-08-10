import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export async function listItems(_req: Request, res: Response) {
  const items = await prisma.item.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
  res.json(items)
}
