import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { OrderStatus } from '../generated/prisma/client'

const ORDER_INCLUDE = {
  branch: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
  items: { include: { item: true } },
  extraItems: true,
} as const

const ADMIN_SETTABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDENTE,
  OrderStatus.EM_SEPARACAO,
  OrderStatus.AGUARDANDO_ENVIO,
  OrderStatus.ENVIADO,
]

export async function createOrder(req: Request, res: Response) {
  const { branchId, items, extras } = req.body as {
    branchId?: number
    items?: { itemId?: string; quantity?: number }[]
    extras?: { name?: string; quantity?: number }[]
  }

  if (!Number.isInteger(branchId)) {
    res.status(400).json({ error: 'Informe uma filial válida' })
    return
  }

  const isAdmin = req.moduleAccess === 'admin'
  if (isAdmin) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId as number } })
    if (!branch) {
      res.status(400).json({ error: 'Filial informada não existe' })
      return
    }
  } else {
    const allowedBranchIds = req.auth!.branchs.map((b) => b.id)
    if (!allowedBranchIds.includes(branchId as number)) {
      res.status(403).json({ error: 'Filial informada não está liberada para este usuário' })
      return
    }
  }

  const hasItems = Array.isArray(items) && items.length > 0
  const validExtras = (Array.isArray(extras) ? extras : []).filter(
    (entry) => typeof entry.name === 'string' && entry.name.trim().length > 0,
  )

  if (!hasItems && validExtras.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um item no pedido' })
    return
  }

  for (const entry of items ?? []) {
    if (!entry.itemId || !Number.isInteger(entry.quantity) || (entry.quantity ?? 0) <= 0) {
      res.status(400).json({ error: 'Cada item precisa de itemId e quantity (inteiro > 0)' })
      return
    }
  }

  for (const entry of validExtras) {
    if (!Number.isInteger(entry.quantity) || (entry.quantity ?? 0) <= 0) {
      res.status(400).json({ error: 'Cada item extra precisa de nome e quantity (inteiro > 0)' })
      return
    }
  }

  if (hasItems) {
    const itemIds = items!.map((entry) => entry.itemId!)
    const existingItems = await prisma.item.findMany({ where: { id: { in: itemIds } } })
    if (existingItems.length !== new Set(itemIds).size) {
      res.status(400).json({ error: 'Um ou mais itens informados não existem' })
      return
    }
  }

  const order = await prisma.order.create({
    data: {
      branchId: branchId as number,
      requestedById: req.auth!.sub,
      items: {
        create: (items ?? []).map((entry) => ({
          itemId: entry.itemId!,
          quantity: entry.quantity!,
        })),
      },
      extraItems: {
        create: validExtras.map((entry) => ({
          name: entry.name!.trim(),
          quantity: entry.quantity!,
        })),
      },
    },
    include: ORDER_INCLUDE,
  })

  res.status(201).json(order)
}

export async function listOrders(req: Request, res: Response) {
  const isAdmin = req.moduleAccess === 'admin'
  const branchIds = req.auth!.branchs.map((b) => b.id)

  const orders = await prisma.order.findMany({
    where: isAdmin ? {} : { branchId: { in: branchIds } },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })

  res.json(orders)
}

export async function updateOrderStatus(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do pedido inválido' })
    return
  }
  const { status } = req.body as { status?: string }

  if (!status || !ADMIN_SETTABLE_STATUSES.includes(status as OrderStatus)) {
    res.status(400).json({
      error: `status deve ser um de: ${ADMIN_SETTABLE_STATUSES.join(', ')}`,
    })
    return
  }

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (order.status === OrderStatus.ENTREGUE) {
    res.status(400).json({ error: 'Pedido já foi entregue e não pode mudar de estágio' })
    return
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: status as OrderStatus },
    include: ORDER_INCLUDE,
  })

  res.json(updated)
}

export async function confirmDelivery(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do pedido inválido' })
    return
  }
  const isAdmin = req.moduleAccess === 'admin'

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (!isAdmin) {
    const allowedBranchIds = req.auth!.branchs.map((b) => b.id)
    if (!allowedBranchIds.includes(order.branchId)) {
      res.status(403).json({ error: 'Esse pedido não pertence a uma filial liberada para você' })
      return
    }
  }
  if (order.status !== OrderStatus.ENVIADO) {
    res.status(400).json({ error: 'Só é possível confirmar entrega de pedidos enviados' })
    return
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: OrderStatus.ENTREGUE, deliveredAt: new Date() },
    include: ORDER_INCLUDE,
  })

  res.json(updated)
}
