import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma, PurchaseStatus, StockMovementType } from '../generated/prisma/client'
import { trimOrNull, userIdOf } from '../lib/access'
import { dailyConsumptionByItem, round, weightedAverageCost } from '../lib/stock'
import { uploadInvoicePhoto, deleteUploadedFile, uploadErrorMessage } from '../middlewares/upload'

const PURCHASE_INCLUDE = {
  supplier: true,
  createdBy: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
  items: { include: { item: { include: { category: true, packaging: true, supplier: true } } }, orderBy: { id: 'asc' } },
} as const satisfies Prisma.PurchaseInclude

function readId(req: Request, res: Response): string | null {
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    res.status(400).json({ error: 'Id da compra inválido' })
    return null
  }
  return id
}

export async function listPurchases(req: Request, res: Response) {
  const status =
    typeof req.query.status === 'string' && req.query.status in PurchaseStatus
      ? (req.query.status as PurchaseStatus)
      : null
  const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null
  const take = Math.min(Math.max(Number(req.query.take) || 30, 1), 100)

  const rows = await prisma.purchase.findMany({
    where: status ? { status } : {},
    include: PURCHASE_INCLUDE,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const hasMore = rows.length > take
  const page = rows.slice(0, take)
  res.json({ purchases: page, nextCursor: hasMore ? page[page.length - 1].id : null })
}

interface ReceiveLine {
  itemId: string
  quantity: number
  unitCost: number | null
}

/** Dá entrada no estoque e recalcula o custo médio dos produtos com custo informado. */
async function receiveLines(tx: Prisma.TransactionClient, purchaseId: string, lines: ReceiveLine[], userId: number) {
  for (const line of lines) {
    if (line.quantity <= 0) continue
    const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } })
    await tx.stockMovement.create({
      data: {
        itemId: line.itemId,
        type: StockMovementType.ENTRADA,
        quantity: line.quantity,
        reason: 'Compra recebida',
        purchaseId,
        createdById: userId,
      },
    })
    await tx.item.update({
      where: { id: line.itemId },
      data: {
        stockQuantity: { increment: line.quantity },
        ...(line.unitCost !== null
          ? { price: weightedAverageCost(item.stockQuantity, item.price, line.quantity, line.unitCost) }
          : {}),
      },
    })
  }
}

function isValidCost(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export async function createPurchase(req: Request, res: Response) {
  const { supplierId, notes, items, receiveNow } = req.body as {
    supplierId?: string
    notes?: string
    items?: { itemId?: string; quantity?: number; unitCost?: number | null }[]
    receiveNow?: boolean
  }

  if (!supplierId) {
    res.status(400).json({ error: 'Informe o fornecedor' })
    return
  }
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) {
    res.status(400).json({ error: 'Fornecedor informado não existe' })
    return
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um item na compra' })
    return
  }
  for (const entry of items) {
    if (!entry.itemId || !Number.isInteger(entry.quantity) || (entry.quantity ?? 0) <= 0) {
      res.status(400).json({ error: 'Cada item precisa de itemId e quantity (inteiro > 0)' })
      return
    }
    if (entry.unitCost !== undefined && entry.unitCost !== null && !isValidCost(entry.unitCost)) {
      res.status(400).json({ error: 'unitCost deve ser um número maior ou igual a 0' })
      return
    }
  }

  const itemIds = items.map((entry) => entry.itemId!)
  const existingCount = await prisma.item.count({ where: { id: { in: itemIds } } })
  if (existingCount !== new Set(itemIds).size) {
    res.status(400).json({ error: 'Um ou mais itens informados não existem' })
    return
  }

  // sem receiveNow (padrão antigo), a compra entra direto no estoque
  const receiving = receiveNow !== false
  const userId = userIdOf(req)
  const now = new Date()

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        supplierId,
        notes: trimOrNull(notes),
        status: receiving ? PurchaseStatus.RECEBIDO : PurchaseStatus.PEDIDO,
        createdById: userId,
        ...(receiving ? { receivedAt: now, receivedById: userId } : {}),
        items: {
          create: items.map((entry) => ({
            itemId: entry.itemId!,
            quantity: entry.quantity!,
            receivedQuantity: receiving ? entry.quantity! : null,
            unitCost: isValidCost(entry.unitCost) ? entry.unitCost : null,
          })),
        },
      },
    })

    if (receiving) {
      await receiveLines(
        tx,
        created.id,
        items.map((entry) => ({
          itemId: entry.itemId!,
          quantity: entry.quantity!,
          unitCost: isValidCost(entry.unitCost) ? entry.unitCost : null,
        })),
        userId,
      )
    }

    return tx.purchase.findUniqueOrThrow({ where: { id: created.id }, include: PURCHASE_INCLUDE })
  })

  res.status(201).json(purchase)
}

export async function receivePurchase(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return
  const { items, notes } = req.body as {
    items?: { purchaseItemId?: string; receivedQuantity?: number; unitCost?: number | null }[]
    notes?: string
  }

  const purchase = await prisma.purchase.findUnique({ where: { id }, include: { items: true } })
  if (!purchase) {
    res.status(404).json({ error: 'Compra não encontrada' })
    return
  }
  if (purchase.status !== PurchaseStatus.PEDIDO) {
    res.status(400).json({ error: 'Esse pedido de compra já foi recebido ou cancelado' })
    return
  }

  const entryById = new Map((Array.isArray(items) ? items : []).map((entry) => [entry.purchaseItemId, entry]))
  const lines: (ReceiveLine & { purchaseItemId: string })[] = []
  for (const purchaseItem of purchase.items) {
    const entry = entryById.get(purchaseItem.id)
    const received = entry?.receivedQuantity ?? purchaseItem.quantity
    if (!Number.isInteger(received) || received < 0) {
      res.status(400).json({ error: 'A quantidade recebida deve ser um inteiro maior ou igual a 0' })
      return
    }
    const unitCost = entry && entry.unitCost !== undefined ? entry.unitCost : purchaseItem.unitCost
    if (unitCost !== null && !isValidCost(unitCost)) {
      res.status(400).json({ error: 'unitCost deve ser um número maior ou igual a 0' })
      return
    }
    lines.push({ purchaseItemId: purchaseItem.id, itemId: purchaseItem.itemId, quantity: received, unitCost })
  }

  const userId = userIdOf(req)
  const updated = await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      await tx.purchaseItem.update({
        where: { id: line.purchaseItemId },
        data: { receivedQuantity: line.quantity, unitCost: line.unitCost },
      })
    }
    await receiveLines(tx, id, lines, userId)
    const extraNotes = trimOrNull(notes)
    await tx.purchase.update({
      where: { id },
      data: {
        status: PurchaseStatus.RECEBIDO,
        receivedAt: new Date(),
        receivedById: userId,
        ...(extraNotes ? { notes: purchase.notes ? `${purchase.notes}\n${extraNotes}` : extraNotes } : {}),
      },
    })
    return tx.purchase.findUniqueOrThrow({ where: { id }, include: PURCHASE_INCLUDE })
  })

  res.json(updated)
}

export async function cancelPurchase(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  const purchase = await prisma.purchase.findUnique({ where: { id } })
  if (!purchase) {
    res.status(404).json({ error: 'Compra não encontrada' })
    return
  }
  if (purchase.status !== PurchaseStatus.PEDIDO) {
    res.status(400).json({ error: 'Só dá para cancelar um pedido de compra que ainda não chegou' })
    return
  }

  const updated = await prisma.purchase.update({
    where: { id },
    data: { status: PurchaseStatus.CANCELADO },
    include: PURCHASE_INCLUDE,
  })
  res.json(updated)
}

export function uploadPurchaseInvoice(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  uploadInvoicePhoto(req, res, async (err: unknown) => {
    if (err) {
      res.status(400).json({ error: uploadErrorMessage(err) })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'Envie uma imagem no campo "invoice"' })
      return
    }

    const relativePath = `notas-fiscais/${req.file.filename}`
    const existing = await prisma.purchase.findUnique({ where: { id } })
    if (!existing) {
      deleteUploadedFile(relativePath)
      res.status(404).json({ error: 'Compra não encontrada' })
      return
    }

    if (existing.invoicePath) deleteUploadedFile(existing.invoicePath)

    const purchase = await prisma.purchase.update({
      where: { id },
      data: { invoicePath: relativePath },
      include: PURCHASE_INCLUDE,
    })
    res.json(purchase)
  })
}

export async function removePurchaseInvoice(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  const existing = await prisma.purchase.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Compra não encontrada' })
    return
  }
  if (existing.invoicePath) deleteUploadedFile(existing.invoicePath)

  const purchase = await prisma.purchase.update({
    where: { id },
    data: { invoicePath: null },
    include: PURCHASE_INCLUDE,
  })
  res.json(purchase)
}

/** Quanto de cada produto já foi pedido aos fornecedores e ainda não chegou. */
async function onOrderByItem(): Promise<Map<string, number>> {
  const rows = await prisma.purchaseItem.groupBy({
    by: ['itemId'],
    where: { purchase: { status: PurchaseStatus.PEDIDO } },
    _sum: { quantity: true },
  })
  return new Map(rows.map((row) => [row.itemId, row._sum.quantity ?? 0]))
}

export async function getPurchaseRecommendations(_req: Request, res: Response) {
  const [items, onOrder, consumption] = await Promise.all([
    prisma.item.findMany({
      where: { active: true },
      include: { supplier: true, category: true, packaging: true },
    }),
    onOrderByItem(),
    dailyConsumptionByItem(),
  ])

  // o que já está a caminho conta como estoque: evita comprar duas vezes a mesma coisa
  const recommendations = items
    .map((item) => {
      const onOrderQuantity = onOrder.get(item.id) ?? 0
      const projected = item.stockQuantity + onOrderQuantity
      return { item, onOrderQuantity, projected }
    })
    // sem mínimo definido, só entra o que ficou com saldo negativo (a central já deve à filial)
    .filter(({ item, projected }) => (item.minStock > 0 ? projected <= item.minStock : projected < 0))
    .map(({ item, onOrderQuantity, projected }) => {
      const target = item.targetStock ?? item.minStock * 2
      return {
        item,
        onOrderQuantity,
        recommendedQuantity: Math.max(1, target - projected),
        avgDailyConsumption: round(consumption.get(item.id) ?? 0),
      }
    })
    .sort(
      (a, b) =>
        a.item.stockQuantity + a.onOrderQuantity - a.item.minStock -
        (b.item.stockQuantity + b.onOrderQuantity - b.item.minStock),
    )

  res.json(recommendations)
}
