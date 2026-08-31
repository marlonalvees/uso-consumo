import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '../generated/prisma/client'

export async function listSuppliers(req: Request, res: Response) {
  const isAdmin = req.moduleAccess === 'admin'
  const suppliers = await prisma.supplier.findMany({
    where: isAdmin ? {} : { active: true },
    orderBy: { name: 'asc' },
  })
  res.json(suppliers)
}

interface SupplierBody {
  name?: string
  cnpj?: string | null
  phone?: string | null
  email?: string | null
  active?: boolean
}

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

function conflictMessage(err: Prisma.PrismaClientKnownRequestError): string {
  const target = (err.meta?.target as string[] | undefined) ?? []
  if (target.includes('cnpj')) return 'Já existe um fornecedor com esse CNPJ'
  return 'Já existe um fornecedor com esse nome'
}

export async function createSupplier(req: Request, res: Response) {
  const { name, cnpj, phone, email } = req.body as SupplierBody
  if (!name?.trim()) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }

  const normalizedCnpj = cnpj?.trim() ? normalizeCnpj(cnpj) : undefined
  if (normalizedCnpj !== undefined && normalizedCnpj.length !== 14) {
    res.status(400).json({ error: 'cnpj deve ter 14 dígitos' })
    return
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        cnpj: normalizedCnpj,
        phone: phone?.trim() || undefined,
        email: email?.trim() || undefined,
      },
    })
    res.status(201).json(supplier)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: conflictMessage(err) })
      return
    }
    throw err
  }
}

export async function updateSupplier(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do fornecedor inválido' })
    return
  }
  const { name, cnpj, phone, email, active } = req.body as SupplierBody

  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: 'name não pode ser vazio' })
    return
  }

  let normalizedCnpj: string | null | undefined
  if (cnpj === undefined) {
    normalizedCnpj = undefined
  } else if (cnpj === null || !cnpj.trim()) {
    normalizedCnpj = null
  } else {
    normalizedCnpj = normalizeCnpj(cnpj)
    if (normalizedCnpj.length !== 14) {
      res.status(400).json({ error: 'cnpj deve ter 14 dígitos' })
      return
    }
  }

  const existing = await prisma.supplier.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Fornecedor não encontrado' })
    return
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: name?.trim(),
        cnpj: normalizedCnpj,
        phone: phone === undefined ? undefined : phone?.trim() || null,
        email: email === undefined ? undefined : email?.trim() || null,
        active,
      },
    })
    res.json(supplier)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: conflictMessage(err) })
      return
    }
    throw err
  }
}

export async function deleteSupplier(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do fornecedor inválido' })
    return
  }

  const existing = await prisma.supplier.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Fornecedor não encontrado' })
    return
  }

  try {
    await prisma.supplier.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      const supplier = await prisma.supplier.update({ where: { id }, data: { active: false } })
      res.status(200).json({
        ...supplier,
        warning: 'Fornecedor já está vinculado a produtos ou compras e não pode ser apagado — foi apenas desativado',
      })
      return
    }
    throw err
  }
}
