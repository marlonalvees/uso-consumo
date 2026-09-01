import type { Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { uploadInvoicePhoto, deleteUploadedFile } from '../middlewares/upload'

const PURCHASE_INCLUDE = {
  supplier: true,
  items: { include: { item: { include: { category: true, packaging: true, supplier: true } } } },
} as const

export async function listPurchases(_req: Request, res: Response) {
  const purchases = await prisma.purchase.findMany({
    include: PURCHASE_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json(purchases)
}

export async function createPurchase(req: Request, res: Response) {
  const { supplierId, notes, items } = req.body as {
    supplierId?: string
    notes?: string
    items?: { itemId?: string; quantity?: number; unitCost?: number }[]
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
    if (entry.unitCost !== undefined && (typeof entry.unitCost !== 'number' || entry.unitCost < 0)) {
      res.status(400).json({ error: 'unitCost deve ser um número maior ou igual a 0' })
      return
    }
  }

  const itemIds = items.map((entry) => entry.itemId!)
  const existingItems = await prisma.item.findMany({ where: { id: { in: itemIds } } })
  if (existingItems.length !== new Set(itemIds).size) {
    res.status(400).json({ error: 'Um ou mais itens informados não existem' })
    return
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        supplierId,
        notes: notes?.trim() || undefined,
        items: {
          create: items.map((entry) => ({
            itemId: entry.itemId!,
            quantity: entry.quantity!,
            unitCost: entry.unitCost ?? undefined,
          })),
        },
      },
      include: PURCHASE_INCLUDE,
    })

    for (const entry of items) {
      await tx.stockMovement.create({
        data: {
          itemId: entry.itemId!,
          type: 'ENTRADA',
          quantity: entry.quantity!,
          reason: 'Compra registrada',
          purchaseId: created.id,
        },
      })
      await tx.item.update({
        where: { id: entry.itemId! },
        data: { stockQuantity: { increment: entry.quantity! } },
      })
    }

    return created
  })

  res.status(201).json(purchase)
}

export function uploadPurchaseInvoice(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id da compra inválido' })
    return
  }

  uploadInvoicePhoto(req, res, async (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Imagem muito grande — máximo 5MB'
          : err instanceof Error
            ? err.message
            : 'Não foi possível enviar a imagem'
      res.status(400).json({ error: message })
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
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id da compra inválido' })
    return
  }

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

export async function getPurchaseRecommendations(_req: Request, res: Response) {
  const items = await prisma.item.findMany({
    where: { active: true },
    include: { supplier: true, category: true, packaging: true },
  })

  const recommendations = items
    .filter((item) => item.stockQuantity <= item.minStock)
    .map((item) => {
      const target = item.targetStock ?? item.minStock * 2
      const recommendedQuantity = Math.max(1, target - item.stockQuantity)
      return { item, recommendedQuantity }
    })
    .sort((a, b) => a.item.stockQuantity - a.item.minStock - (b.item.stockQuantity - b.item.minStock))

  res.json(recommendations)
}
