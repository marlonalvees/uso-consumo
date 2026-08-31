import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '../generated/prisma/client'

export async function listCategories(_req: Request, res: Response) {
  const categories = await prisma.itemCategory.findMany({ orderBy: { name: 'asc' } })
  res.json(categories)
}

export async function createCategory(req: Request, res: Response) {
  const { name } = req.body as { name?: string }
  if (!name?.trim()) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }

  try {
    const category = await prisma.itemCategory.create({ data: { name: name.trim() } })
    res.status(201).json(category)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe uma categoria com esse nome' })
      return
    }
    throw err
  }
}

export async function updateCategory(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id da categoria inválido' })
    return
  }
  const { name } = req.body as { name?: string }
  if (!name?.trim()) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }

  const existing = await prisma.itemCategory.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Categoria não encontrada' })
    return
  }

  try {
    const category = await prisma.itemCategory.update({ where: { id }, data: { name: name.trim() } })
    res.json(category)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe uma categoria com esse nome' })
      return
    }
    throw err
  }
}

export async function deleteCategory(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id da categoria inválido' })
    return
  }

  const existing = await prisma.itemCategory.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  })
  if (!existing) {
    res.status(404).json({ error: 'Categoria não encontrada' })
    return
  }
  if (existing._count.items > 0) {
    res.status(409).json({
      error: `Categoria em uso por ${existing._count.items} produto(s) — mude a categoria desses produtos antes de apagar`,
    })
    return
  }

  await prisma.itemCategory.delete({ where: { id } })
  res.status(204).send()
}
