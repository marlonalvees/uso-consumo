import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isModuleAdmin } from '../middlewares/auth'

export async function me(req: Request, res: Response) {
  const access = req.moduleAccess!
  const branchIds = req.auth!.branchs.map((b) => b.id)

  const branches = branchIds.length
    ? await prisma.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  res.json({ id: req.auth!.sub, isAdmin: isModuleAdmin(access), access, branches })
}
