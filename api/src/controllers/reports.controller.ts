import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { OrderStatus, StockMovementType } from '../generated/prisma/client'
import { lineValue, shippedOrderItems } from '../lib/consumption'
import { monthKey, monthStart, round } from '../lib/stock'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.round(parsed), min), max)
}

/**
 * Consumo (R$) por filial e mês, pela data de envio. Marca a filial cujo mês atual passou
 * 30% da média dos meses anteriores do período.
 */
export async function consumptionReport(req: Request, res: Response) {
  const months = readNumber(req.query.months, 6, 2, 24)
  const now = new Date()
  const keys = Array.from({ length: months }, (_, i) => monthKey(monthStart(now, i - (months - 1))))
  const currentKey = keys[keys.length - 1]

  const [lines, branches] = await Promise.all([
    shippedOrderItems(monthStart(now, -(months - 1)), null),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ])
  const nameById = new Map(branches.map((b) => [b.id, b.name]))

  const byBranch = new Map<number, Record<string, number>>()
  for (const line of lines) {
    const key = monthKey(line.order.sentAt!)
    const values = byBranch.get(line.order.branchId) ?? {}
    values[key] = (values[key] ?? 0) + lineValue(line)
    byBranch.set(line.order.branchId, values)
  }

  const rows = [...byBranch.entries()]
    .map(([branchId, values]) => {
      const rounded = Object.fromEntries(keys.map((key) => [key, round(values[key] ?? 0)]))
      const previous = keys.slice(0, -1).map((key) => rounded[key])
      const previousAverage = previous.reduce((sum, v) => sum + v, 0) / previous.length
      return {
        branchId,
        branchName: nameById.get(branchId) ?? `Filial ${branchId}`,
        values: rounded,
        total: round(Object.values(rounded).reduce((sum, v) => sum + v, 0)),
        previousAverage: round(previousAverage),
        aboveAverage: previousAverage > 0 && rounded[currentKey] > previousAverage * 1.3,
      }
    })
    .sort((a, b) => b.total - a.total)

  res.json({ months: keys, rows })
}

/** Tempo de atendimento: do pedido ao envio (central) e do envio à confirmação (filial). */
export async function serviceTimeReport(req: Request, res: Response) {
  const months = readNumber(req.query.months, 3, 1, 24)
  const since = monthStart(new Date(), -(months - 1))

  const orders = await prisma.order.findMany({
    where: { sentAt: { gte: since }, status: { in: [OrderStatus.ENVIADO, OrderStatus.ENTREGUE] } },
    select: { branchId: true, createdAt: true, sentAt: true, deliveredAt: true, branch: { select: { name: true } } },
  })

  const byBranch = new Map<number, { name: string; toShip: number[]; toConfirm: number[] }>()
  for (const order of orders) {
    const entry = byBranch.get(order.branchId) ?? { name: order.branch.name, toShip: [], toConfirm: [] }
    entry.toShip.push((order.sentAt!.getTime() - order.createdAt.getTime()) / HOUR)
    if (order.deliveredAt) entry.toConfirm.push((order.deliveredAt.getTime() - order.sentAt!.getTime()) / HOUR)
    byBranch.set(order.branchId, entry)
  }

  const average = (values: number[]) => (values.length ? round(values.reduce((s, v) => s + v, 0) / values.length, 1) : null)
  const rows = [...byBranch.entries()]
    .map(([branchId, entry]) => ({
      branchId,
      branchName: entry.name,
      orders: entry.toShip.length,
      avgHoursToShip: average(entry.toShip),
      avgHoursToConfirm: average(entry.toConfirm),
    }))
    .sort((a, b) => (b.avgHoursToShip ?? 0) - (a.avgHoursToShip ?? 0))

  res.json({
    months,
    rows,
    overall: {
      orders: orders.length,
      avgHoursToShip: average([...byBranch.values()].flatMap((e) => e.toShip)),
      avgHoursToConfirm: average([...byBranch.values()].flatMap((e) => e.toConfirm)),
    },
  })
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Itens extras mais pedidos: candidatos a entrar no catálogo. */
export async function extrasReport(req: Request, res: Response) {
  const months = readNumber(req.query.months, 6, 1, 24)
  const since = monthStart(new Date(), -(months - 1))

  const extras = await prisma.orderExtraItem.findMany({
    where: { order: { createdAt: { gte: since }, status: { not: OrderStatus.CANCELADO } } },
    select: { name: true, requestedQuantity: true, orderId: true, order: { select: { branchId: true, createdAt: true } } },
  })

  const groups = new Map<string, { names: Map<string, number>; orders: Set<string>; branches: Set<number>; quantity: number; last: Date }>()
  for (const extra of extras) {
    const key = normalizeName(extra.name)
    const group = groups.get(key) ?? { names: new Map(), orders: new Set(), branches: new Set(), quantity: 0, last: extra.order.createdAt }
    group.names.set(extra.name, (group.names.get(extra.name) ?? 0) + 1)
    group.orders.add(extra.orderId)
    group.branches.add(extra.order.branchId)
    group.quantity += extra.requestedQuantity
    if (extra.order.createdAt > group.last) group.last = extra.order.createdAt
    groups.set(key, group)
  }

  const rows = [...groups.values()]
    .map((group) => ({
      name: [...group.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      timesRequested: group.orders.size,
      totalQuantity: group.quantity,
      branches: group.branches.size,
      lastRequestedAt: group.last,
    }))
    .sort((a, b) => b.timesRequested - a.timesRequested || b.totalQuantity - a.totalQuantity)

  res.json({ months, rows })
}

/** Produtos com estoque que não saíram nenhuma vez no período (dinheiro parado). */
export async function idleItemsReport(req: Request, res: Response) {
  const days = readNumber(req.query.days, 90, 15, 365)
  const since = new Date(Date.now() - days * DAY)

  const [items, lastOut] = await Promise.all([
    prisma.item.findMany({
      where: { active: true, stockQuantity: { gt: 0 } },
      include: { packaging: true, category: true },
    }),
    prisma.stockMovement.groupBy({
      by: ['itemId'],
      where: { type: StockMovementType.SAIDA },
      _max: { createdAt: true },
    }),
  ])
  const lastOutById = new Map(lastOut.map((row) => [row.itemId, row._max.createdAt]))

  const rows = items
    .filter((item) => {
      const last = lastOutById.get(item.id)
      return !last || last < since
    })
    .map((item) => ({
      item,
      lastOutAt: lastOutById.get(item.id) ?? null,
      stockValue: round(item.stockQuantity * item.price),
    }))
    .sort((a, b) => b.stockValue - a.stockValue)

  res.json({ days, rows })
}

/** Pedidos recebidos com falta ou avaria. */
export async function divergencesReport(req: Request, res: Response) {
  const months = readNumber(req.query.months, 3, 1, 24)
  const since = monthStart(new Date(), -(months - 1))

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.ENTREGUE,
      deliveredAt: { gte: since },
      OR: [{ items: { some: { receiptIssue: { not: null } } } }, { extraItems: { some: { receiptIssue: { not: null } } } }],
    },
    select: {
      id: true,
      deliveredAt: true,
      receiptNotes: true,
      receiptPhotoPath: true,
      branch: { select: { id: true, name: true } },
      items: {
        where: { receiptIssue: { not: null } },
        select: { quantity: true, receivedQuantity: true, receiptIssue: true, item: { select: { name: true } } },
      },
      extraItems: {
        where: { receiptIssue: { not: null } },
        select: { name: true, quantity: true, receivedQuantity: true, receiptIssue: true },
      },
    },
    orderBy: { deliveredAt: 'desc' },
  })

  res.json({
    months,
    rows: orders.map((order) => ({
      orderId: order.id,
      branch: order.branch,
      deliveredAt: order.deliveredAt,
      receiptNotes: order.receiptNotes,
      receiptPhotoPath: order.receiptPhotoPath,
      issues: [
        ...order.items.map((i) => ({ name: i.item.name, sent: i.quantity, received: i.receivedQuantity, issue: i.receiptIssue })),
        ...order.extraItems.map((e) => ({ name: e.name, sent: e.quantity, received: e.receivedQuantity, issue: e.receiptIssue })),
      ],
    })),
  })
}
