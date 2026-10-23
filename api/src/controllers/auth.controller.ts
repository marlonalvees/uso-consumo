import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { isModuleAdmin } from '../middlewares/auth'

export async function me(req: Request, res: Response) {
  const access = req.moduleAccess!
  const branchIds = req.auth!.branchs.map((b) => b.id)

  const [branches, user] = await Promise.all([
    branchIds.length
      ? prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [],
    prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { name: true } }),
  ])

  res.json({ id: req.auth!.sub, name: user?.name ?? null, isAdmin: isModuleAdmin(access), access, branches })
}
