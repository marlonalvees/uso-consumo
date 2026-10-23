import type { Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { Prisma } from '../generated/prisma/client'
import { uploadProductPhoto, deleteUploadedFile } from '../middlewares/upload'
import { CONSUMPTION_WINDOW_DAYS, DEFAULT_LEAD_TIME_DAYS, dailyConsumptionByItem, round } from '../lib/stock'

const ITEM_INCLUDE = {
  category: true,
  packaging: true,
  supplier: { select: { id: true, name: true } },
} as const

export async function listItems(req: Request, res: Response) {
  const isAdmin = req.moduleAccess === 'admin'
  const items = await prisma.item.findMany({
    where: isAdmin ? {} : { active: true },
    include: ITEM_INCLUDE,
    orderBy: { name: 'asc' },
  })
  res.json(items)
}

interface ItemBody {
  name?: string
  packagingId?: string
  categoryId?: string
  supplierId?: string | null
  price?: number
  active?: boolean
  minStock?: number
  targetStock?: number | null
}

async function validateItemBody(
  body: ItemBody,
  { requireName, requirePackaging, requireCategory }: { requireName: boolean; requirePackaging: boolean; requireCategory: boolean },
): Promise<string | null> {
  const { name, packagingId, categoryId, supplierId, price, minStock, targetStock } = body

  if (requireName && !name?.trim()) return 'name é obrigatório'
  if (name !== undefined && !name.trim()) return 'name não pode ser vazio'

  if (requirePackaging && !packagingId) return 'packagingId é obrigatório'
  if (packagingId !== undefined) {
    const packaging = await prisma.packaging.findUnique({ where: { id: packagingId } })
    if (!packaging) return 'Embalagem informada não existe'
  }

  if (requireCategory && !categoryId) return 'categoryId é obrigatório'
  if (categoryId !== undefined) {
    const category = await prisma.itemCategory.findUnique({ where: { id: categoryId } })
    if (!category) return 'Categoria informada não existe'
  }

  if (supplierId !== undefined && supplierId !== null) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) return 'Fornecedor informado não existe'
  }

  if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
    return 'price deve ser um número maior ou igual a 0'
  }
  if (minStock !== undefined && (!Number.isInteger(minStock) || minStock < 0)) {
    return 'minStock deve ser um inteiro maior ou igual a 0'
  }
  if (targetStock !== undefined && targetStock !== null && (!Number.isInteger(targetStock) || targetStock < 0)) {
    return 'targetStock deve ser um inteiro maior ou igual a 0'
  }

  return null
}

export async function createItem(req: Request, res: Response) {
  const body = req.body as ItemBody

  const error = await validateItemBody(body, { requireName: true, requirePackaging: true, requireCategory: true })
  if (error) {
    res.status(400).json({ error })
    return
  }

  try {
    const item = await prisma.item.create({
      data: {
        name: body.name!.trim(),
        packagingId: body.packagingId!,
        categoryId: body.categoryId!,
        supplierId: body.supplierId ?? undefined,
        price: body.price ?? undefined,
        minStock: body.minStock ?? undefined,
        targetStock: body.targetStock ?? undefined,
      },
      include: ITEM_INCLUDE,
    })
    res.status(201).json(item)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe um item com esse nome' })
      return
    }
    throw err
  }
}

export async function updateItem(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do item inválido' })
    return
  }

  const body = req.body as ItemBody

  const error = await validateItemBody(body, { requireName: false, requirePackaging: false, requireCategory: false })
  if (error) {
    res.status(400).json({ error })
    return
  }

  const existing = await prisma.item.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Item não encontrado' })
    return
  }

  try {
    const item = await prisma.item.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        packagingId: body.packagingId,
        categoryId: body.categoryId,
        supplierId: body.supplierId,
        active: body.active,
        price: body.price,
        minStock: body.minStock,
        targetStock: body.targetStock,
      },
      include: ITEM_INCLUDE,
    })
    res.json(item)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe um item com esse nome' })
      return
    }
    throw err
  }
}

export function uploadItemPhoto(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do item inválido' })
    return
  }

  uploadProductPhoto(req, res, async (err: unknown) => {
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
      res.status(400).json({ error: 'Envie uma imagem no campo "photo"' })
      return
    }

    const relativePath = `produtos/${req.file.filename}`
    const existing = await prisma.item.findUnique({ where: { id } })
    if (!existing) {
      deleteUploadedFile(relativePath)
      res.status(404).json({ error: 'Item não encontrado' })
      return
    }

    if (existing.photoPath) deleteUploadedFile(existing.photoPath)

    const item = await prisma.item.update({
      where: { id },
      data: { photoPath: relativePath },
      include: ITEM_INCLUDE,
    })
    res.json(item)
  })
}

export async function removeItemPhoto(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do item inválido' })
    return
  }

  const existing = await prisma.item.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Item não encontrado' })
    return
  }
  if (existing.photoPath) deleteUploadedFile(existing.photoPath)

  const item = await prisma.item.update({
    where: { id },
    data: { photoPath: null },
    include: ITEM_INCLUDE,
  })
  res.json(item)
}

export async function deleteItem(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do item inválido' })
    return
  }

  const existing = await prisma.item.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Item não encontrado' })
    return
  }

  try {
    await prisma.item.delete({ where: { id } })
    if (existing.photoPath) deleteUploadedFile(existing.photoPath)
    res.status(204).send()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      const item = await prisma.item.update({
        where: { id },
        data: { active: false },
        include: ITEM_INCLUDE,
      })
      res.status(200).json({
        ...item,
        warning: 'Item já foi usado em pedidos e não pode ser apagado — foi apenas desativado',
      })
      return
    }
    throw err
  }
}

type AbcClass = 'A' | 'B' | 'C'

/**
 * Sugestão de estoque mínimo e ideal pelo consumo dos últimos 90 dias:
 * mínimo = consumo diário × prazo de entrega + estoque de segurança (metade do consumo no prazo);
 * ideal = mínimo + 30 dias de consumo. A curva ABC (pelo valor consumido) diz o que contar
 * com mais frequência no inventário.
 */
export async function getStockSuggestions(_req: Request, res: Response) {
  const [items, consumption] = await Promise.all([
    prisma.item.findMany({
      where: { active: true },
      select: {
        id: true,
        price: true,
        minStock: true,
        targetStock: true,
        lastCountedAt: true,
        supplier: { select: { leadTimeDays: true } },
      },
    }),
    dailyConsumptionByItem(),
  ])

  const valued = items
    .map((item) => ({ id: item.id, value: (consumption.get(item.id) ?? 0) * item.price }))
    .sort((a, b) => b.value - a.value)
  const totalValue = valued.reduce((sum, row) => sum + row.value, 0)
  const abcById = new Map<string, AbcClass>()
  let accumulated = 0
  for (const row of valued) {
    const shareBefore = totalValue > 0 ? accumulated / totalValue : 1
    abcById.set(row.id, row.value === 0 ? 'C' : shareBefore < 0.8 ? 'A' : shareBefore < 0.95 ? 'B' : 'C')
    accumulated += row.value
  }

  const suggestions = items.map((item) => {
    const daily = consumption.get(item.id) ?? 0
    const leadTimeDays = item.supplier?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS
    const safetyStock = Math.ceil(daily * leadTimeDays * 0.5)
    const suggestedMin = daily > 0 ? Math.ceil(daily * leadTimeDays) + safetyStock : null
    return {
      itemId: item.id,
      avgDailyConsumption: round(daily),
      windowDays: CONSUMPTION_WINDOW_DAYS,
      leadTimeDays,
      suggestedMin,
      suggestedTarget: suggestedMin !== null ? suggestedMin + Math.ceil(daily * 30) : null,
      abcClass: abcById.get(item.id) ?? 'C',
      lastCountedAt: item.lastCountedAt,
    }
  })

  res.json(suggestions)
}

/** Aplica mínimo e ideal de vários produtos de uma vez (ex.: as sugestões pelo consumo). */
export async function updateStockLevels(req: Request, res: Response) {
  const { entries } = req.body as { entries?: { itemId?: string; minStock?: number; targetStock?: number | null }[] }
  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um produto' })
    return
  }
  for (const entry of entries) {
    if (!entry.itemId || !Number.isInteger(entry.minStock) || (entry.minStock ?? -1) < 0) {
      res.status(400).json({ error: 'Cada produto precisa de itemId e minStock (inteiro >= 0)' })
      return
    }
    if (entry.targetStock !== undefined && entry.targetStock !== null && (!Number.isInteger(entry.targetStock) || entry.targetStock < 0)) {
      res.status(400).json({ error: 'targetStock deve ser um inteiro maior ou igual a 0' })
      return
    }
  }

  const ids = entries.map((entry) => entry.itemId!)
  const existingCount = await prisma.item.count({ where: { id: { in: ids } } })
  if (existingCount !== new Set(ids).size) {
    res.status(400).json({ error: 'Um ou mais produtos informados não existem' })
    return
  }

  const updated = await prisma.$transaction(
    entries.map((entry) =>
      prisma.item.update({
        where: { id: entry.itemId! },
        data: { minStock: entry.minStock!, targetStock: entry.targetStock ?? null },
        include: ITEM_INCLUDE,
      }),
    ),
  )
  res.json(updated)
}
