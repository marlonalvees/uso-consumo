import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { OrderStatus } from '../generated/prisma/client'

const ORDER_INCLUDE = {
  branch: { select: { id: true, name: true } },
  items: { include: { item: true } },
} as const

const ADMIN_SETTABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDENTE,
  OrderStatus.EM_SEPARACAO,
  OrderStatus.AGUARDANDO_ENVIO,
  OrderStatus.ENVIADO,
]

export async function createOrder(req: Request, res: Response) {
  const branchId = req.auth!.id
  const { items } = req.body as { items?: { itemId?: string; quantity?: number }[] }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um item no pedido' })
    return
  }

  for (const entry of items) {
    if (!entry.itemId || !Number.isInteger(entry.quantity) || (entry.quantity ?? 0) <= 0) {
      res.status(400).json({ error: 'Cada item precisa de itemId e quantity (inteiro > 0)' })
      return
    }
  }

  const itemIds = items.map((entry) => entry.itemId!)
  const existingItems = await prisma.item.findMany({ where: { id: { in: itemIds } } })
  if (existingItems.length !== new Set(itemIds).size) {
    res.status(400).json({ error: 'Um ou mais itens informados não existem' })
    return
  }

  const order = await prisma.order.create({
    data: {
      branchId,
      items: {
        create: items.map((entry) => ({
          itemId: entry.itemId!,
          quantity: entry.quantity!,
        })),
      },
    },
    include: ORDER_INCLUDE,
  })

  res.status(201).json(order)
}

export async function listOrders(req: Request, res: Response) {
  const { role, id } = req.auth!

  const orders = await prisma.order.findMany({
    where: role === 'FILIAL' ? { branchId: id } : {},
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
  const branchId = req.auth!.id

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (order.branchId !== branchId) {
    res.status(403).json({ error: 'Esse pedido não pertence à sua filial' })
    return
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
