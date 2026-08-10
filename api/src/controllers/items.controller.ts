import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ItemCategory, Prisma } from '../generated/prisma/client'

export async function listItems(req: Request, res: Response) {
  const isAdmin = req.auth?.role === 'ADMIN'
  const items = await prisma.item.findMany({
    where: isAdmin ? {} : { active: true },
    orderBy: { name: 'asc' },
  })
  res.json(items)
}

export async function createItem(req: Request, res: Response) {
  const { name, unit, category } = req.body as {
    name?: string
    unit?: string
    category?: string
  }

  if (!name?.trim() || !unit?.trim()) {
    res.status(400).json({ error: 'name e unit são obrigatórios' })
    return
  }
  if (category && !Object.values(ItemCategory).includes(category as ItemCategory)) {
    res.status(400).json({ error: `category deve ser um de: ${Object.values(ItemCategory).join(', ')}` })
    return
  }

  try {
    const item = await prisma.item.create({
      data: {
        name: name.trim(),
        unit: unit.trim(),
        category: (category as ItemCategory) ?? undefined,
      },
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

  const { name, unit, category, active } = req.body as {
    name?: string
    unit?: string
    category?: string
    active?: boolean
  }

  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: 'name não pode ser vazio' })
    return
  }
  if (unit !== undefined && !unit.trim()) {
    res.status(400).json({ error: 'unit não pode ser vazio' })
    return
  }
  if (category !== undefined && !Object.values(ItemCategory).includes(category as ItemCategory)) {
    res.status(400).json({ error: `category deve ser um de: ${Object.values(ItemCategory).join(', ')}` })
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
        name: name?.trim(),
        unit: unit?.trim(),
        category: category as ItemCategory | undefined,
        active,
      },
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
    res.status(204).send()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      const item = await prisma.item.update({ where: { id }, data: { active: false } })
      res.status(200).json({
        ...item,
        warning: 'Item já foi usado em pedidos e não pode ser apagado — foi apenas desativado',
      })
      return
    }
    throw err
  }
}
