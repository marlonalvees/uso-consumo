import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '../generated/prisma/client'

export async function listPackaging(_req: Request, res: Response) {
  const packaging = await prisma.packaging.findMany({ orderBy: { name: 'asc' } })
  res.json(packaging)
}

export async function createPackaging(req: Request, res: Response) {
  const { name } = req.body as { name?: string }
  if (!name?.trim()) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }

  try {
    const packaging = await prisma.packaging.create({ data: { name: name.trim() } })
    res.status(201).json(packaging)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe uma embalagem com esse nome' })
      return
    }
    throw err
  }
}

export async function updatePackaging(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id da embalagem inválido' })
    return
  }
  const { name } = req.body as { name?: string }
  if (!name?.trim()) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }

  const existing = await prisma.packaging.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Embalagem não encontrada' })
    return
  }

  try {
    const packaging = await prisma.packaging.update({ where: { id }, data: { name: name.trim() } })
    res.json(packaging)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Já existe uma embalagem com esse nome' })
      return
    }
    throw err
  }
}

export async function deletePackaging(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id da embalagem inválido' })
    return
  }

  const existing = await prisma.packaging.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  })
  if (!existing) {
    res.status(404).json({ error: 'Embalagem não encontrada' })
    return
  }
  if (existing._count.items > 0) {
    res.status(409).json({
      error: `Embalagem em uso por ${existing._count.items} produto(s) — mude a embalagem desses produtos antes de apagar`,
    })
    return
  }

  await prisma.packaging.delete({ where: { id } })
  res.status(204).send()
}
