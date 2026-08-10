import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export async function listBranches(_req: Request, res: Response) {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  res.json(branches)
}
