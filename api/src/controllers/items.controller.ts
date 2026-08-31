import type { Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { Prisma } from '../generated/prisma/client'
import { uploadProductPhoto, deleteProductPhoto } from '../middlewares/upload'

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
      deleteProductPhoto(relativePath)
      res.status(404).json({ error: 'Item não encontrado' })
      return
    }

    if (existing.photoPath) deleteProductPhoto(existing.photoPath)

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
  if (existing.photoPath) deleteProductPhoto(existing.photoPath)

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
    if (existing.photoPath) deleteProductPhoto(existing.photoPath)
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
