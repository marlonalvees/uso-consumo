import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { OrderStatus } from '../generated/prisma/client'
import { canAccessBranch } from '../lib/access'
import { listPendingItems } from '../lib/pending'
import { shippedOrderItems, sumByBranch } from '../lib/consumption'
import { monthStart, round } from '../lib/stock'

export async function listBranches(_req: Request, res: Response) {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  res.json(branches)
}

function readBranchId(req: Request, res: Response): number | null {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Filial inválida' })
    return null
  }
  if (!canAccessBranch(req, id)) {
    res.status(403).json({ error: 'Filial não liberada para você' })
    return null
  }
  return id
}

const PAR_INCLUDE = { item: { include: { category: true, packaging: true } } } as const

export async function getBranchPars(req: Request, res: Response) {
  const branchId = readBranchId(req, res)
  if (branchId === null) return

  const pars = await prisma.branchItemPar.findMany({
    where: { branchId, item: { active: true } },
    include: PAR_INCLUDE,
    orderBy: { item: { name: 'asc' } },
  })
  res.json(pars)
}

/** Substitui o estoque ideal da filial: quantidade 0 tira o produto da lista. */
export async function setBranchPars(req: Request, res: Response) {
  const branchId = readBranchId(req, res)
  if (branchId === null) return
  const { entries } = req.body as { entries?: { itemId?: string; quantity?: number }[] }

  if (!Array.isArray(entries)) {
    res.status(400).json({ error: 'Informe a lista de produtos' })
    return
  }
  for (const entry of entries) {
    if (!entry.itemId || !Number.isInteger(entry.quantity) || (entry.quantity ?? -1) < 0) {
      res.status(400).json({ error: 'Cada produto precisa de itemId e quantity (inteiro >= 0)' })
      return
    }
  }
  const branch = await prisma.branch.findUnique({ where: { id: branchId } })
  if (!branch) {
    res.status(404).json({ error: 'Filial não encontrada' })
    return
  }

  const positive = entries.filter((entry) => entry.quantity! > 0)
  const itemIds = positive.map((entry) => entry.itemId!)
  if (new Set(itemIds).size !== itemIds.length) {
    res.status(400).json({ error: 'O mesmo produto aparece mais de uma vez' })
    return
  }
  const existingCount = await prisma.item.count({ where: { id: { in: itemIds } } })
  if (existingCount !== itemIds.length) {
    res.status(400).json({ error: 'Um ou mais produtos informados não existem' })
    return
  }

  await prisma.$transaction([
    prisma.branchItemPar.deleteMany({ where: { branchId, itemId: { notIn: itemIds } } }),
    ...positive.map((entry) =>
      prisma.branchItemPar.upsert({
        where: { branchId_itemId: { branchId, itemId: entry.itemId! } },
        update: { quantity: entry.quantity! },
        create: { branchId, itemId: entry.itemId!, quantity: entry.quantity! },
      }),
    ),
  ])

  const pars = await prisma.branchItemPar.findMany({
    where: { branchId },
    include: PAR_INCLUDE,
    orderBy: { item: { name: 'asc' } },
  })
  res.json(pars)
}

export async function setBranchBudget(req: Request, res: Response) {
  const branchId = readBranchId(req, res)
  if (branchId === null) return
  const { monthlyAmount } = req.body as { monthlyAmount?: number | null }

  if (monthlyAmount === null || monthlyAmount === undefined) {
    await prisma.branchBudget.deleteMany({ where: { branchId } })
    res.json({ branchId, monthlyAmount: null })
    return
  }
  if (typeof monthlyAmount !== 'number' || !Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
    res.status(400).json({ error: 'A cota deve ser um valor maior ou igual a 0' })
    return
  }

  const budget = await prisma.branchBudget.upsert({
    where: { branchId },
    update: { monthlyAmount },
    create: { branchId, monthlyAmount },
  })
  res.json(budget)
}

/** Consumo do mês (pela data de envio), média dos 3 meses anteriores, cota e pendências da filial. */
export async function getBranchSummary(req: Request, res: Response) {
  const branchId = readBranchId(req, res)
  if (branchId === null) return

  const now = new Date()
  const [monthLines, previousLines, budget, pending] = await Promise.all([
    shippedOrderItems(monthStart(now), null, [branchId]),
    shippedOrderItems(monthStart(now, -3), monthStart(now), [branchId]),
    prisma.branchBudget.findUnique({ where: { branchId } }),
    listPendingItems([branchId]),
  ])

  res.json({
    branchId,
    monthConsumption: round(sumByBranch(monthLines).get(branchId) ?? 0),
    lastMonthsAverage: round((sumByBranch(previousLines).get(branchId) ?? 0) / 3),
    monthlyBudget: budget?.monthlyAmount ?? null,
    pendingCount: pending.length,
  })
}

/** Painel das filiais pra central: consumo, cota, pendências e estoque ideal de cada uma. */
export async function getBranchesOverview(_req: Request, res: Response) {
  const now = new Date()
  const [branches, monthLines, previousLines, budgets, pending, parCounts, openOrders] = await Promise.all([
    prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    shippedOrderItems(monthStart(now), null),
    shippedOrderItems(monthStart(now, -3), monthStart(now)),
    prisma.branchBudget.findMany(),
    listPendingItems(),
    prisma.branchItemPar.groupBy({ by: ['branchId'], _count: { _all: true } }),
    prisma.order.findMany({
      where: { status: { in: [OrderStatus.RECEBIDO, OrderStatus.EM_ANDAMENTO, OrderStatus.ENVIADO] } },
      select: { branchId: true, status: true },
    }),
  ])

  const month = sumByBranch(monthLines)
  const previous = sumByBranch(previousLines)
  const budgetById = new Map(budgets.map((b) => [b.branchId, b.monthlyAmount]))
  const parCountById = new Map(parCounts.map((p) => [p.branchId, p._count._all]))

  res.json(
    branches.map((branch) => ({
      ...branch,
      monthConsumption: round(month.get(branch.id) ?? 0),
      lastMonthsAverage: round((previous.get(branch.id) ?? 0) / 3),
      monthlyBudget: budgetById.get(branch.id) ?? null,
      pendingCount: pending.filter((p) => p.branchId === branch.id).length,
      parCount: parCountById.get(branch.id) ?? 0,
      openOrders: openOrders.filter((o) => o.branchId === branch.id).map((o) => o.status),
    })),
  )
}
