import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { OrderStatus } from '../generated/prisma/client'

const ORDER_INCLUDE = {
  branch: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
  items: { include: { item: { include: { category: true, packaging: true } } } },
  extraItems: true,
} as const

const ADMIN_SETTABLE_STATUSES: OrderStatus[] = [
  OrderStatus.RECEBIDO,
  OrderStatus.EM_ANDAMENTO,
  OrderStatus.ENVIADO,
]

const EDITABLE_STATUSES: OrderStatus[] = [OrderStatus.RECEBIDO, OrderStatus.EM_ANDAMENTO]

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
          requestedQuantity: entry.quantity!,
        })),
      },
      extraItems: {
        create: validExtras.map((entry) => ({
          name: entry.name!.trim(),
          quantity: entry.quantity!,
          requestedQuantity: entry.quantity!,
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

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (order.status === OrderStatus.ENTREGUE) {
    res.status(400).json({ error: 'Pedido já foi entregue e não pode mudar de estágio' })
    return
  }

  if (status === OrderStatus.ENVIADO) {
    const alreadyShipped = await prisma.stockMovement.findFirst({ where: { orderId: id, type: 'SAIDA' } })
    if (!alreadyShipped) {
      await prisma.$transaction(async (tx) => {
        for (const orderItem of order.items) {
          if (orderItem.quantity <= 0) continue
          await tx.stockMovement.create({
            data: {
              itemId: orderItem.itemId,
              type: 'SAIDA',
              quantity: orderItem.quantity,
              reason: 'Pedido enviado',
              orderId: id,
            },
          })
          await tx.item.update({
            where: { id: orderItem.itemId },
            data: { stockQuantity: { decrement: orderItem.quantity } },
          })
        }
        await tx.order.update({ where: { id }, data: { status: status as OrderStatus } })
      })
    } else {
      await prisma.order.update({ where: { id }, data: { status: status as OrderStatus } })
    }
  } else {
    await prisma.order.update({ where: { id }, data: { status: status as OrderStatus } })
  }

  const updated = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  res.json(updated)
}

export async function updateOrderFulfillment(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do pedido inválido' })
    return
  }

  const { items, extras } = req.body as {
    items?: { itemId?: string; quantity?: number }[]
    extras?: { id?: string; name?: string; quantity?: number }[]
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, extraItems: true },
  })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (!EDITABLE_STATUSES.includes(order.status)) {
    res.status(400).json({ error: 'Só é possível editar os itens enquanto o pedido está em Recebido ou Em andamento' })
    return
  }

  const itemEntries = Array.isArray(items) ? items : []
  const extraEntries = Array.isArray(extras) ? extras : []

  for (const entry of itemEntries) {
    if (!entry.itemId || !Number.isInteger(entry.quantity) || (entry.quantity ?? -1) < 0) {
      res.status(400).json({ error: 'Cada item precisa de itemId e quantity (inteiro >= 0)' })
      return
    }
  }
  for (const entry of extraEntries) {
    if (!Number.isInteger(entry.quantity) || (entry.quantity ?? -1) < 0) {
      res.status(400).json({ error: 'Cada item extra precisa de quantity (inteiro >= 0)' })
      return
    }
    if (!entry.id && !entry.name?.trim()) {
      res.status(400).json({ error: 'Item extra novo precisa de um nome' })
      return
    }
  }

  const newItemIds = itemEntries.map((e) => e.itemId!)
  if (newItemIds.length) {
    const existingCatalogItems = await prisma.item.findMany({ where: { id: { in: newItemIds } } })
    if (existingCatalogItems.length !== new Set(newItemIds).size) {
      res.status(400).json({ error: 'Um ou mais itens informados não existem no catálogo' })
      return
    }
  }

  const existingExtraIds = new Set(order.extraItems.map((e) => e.id))
  for (const entry of extraEntries) {
    if (entry.id && !existingExtraIds.has(entry.id)) {
      res.status(400).json({ error: 'Um item extra informado não pertence a este pedido' })
      return
    }
  }

  await prisma.$transaction(async (tx) => {
    const existingByItemId = new Map(order.items.map((oi) => [oi.itemId, oi]))
    const incomingItemIds = new Set(itemEntries.map((e) => e.itemId!))

    for (const entry of itemEntries) {
      const existing = existingByItemId.get(entry.itemId!)
      if (existing) {
        await tx.orderItem.update({ where: { id: existing.id }, data: { quantity: entry.quantity! } })
      } else {
        await tx.orderItem.create({
          data: { orderId: id, itemId: entry.itemId!, quantity: entry.quantity!, requestedQuantity: 0 },
        })
      }
    }
    for (const existing of order.items) {
      if (incomingItemIds.has(existing.itemId)) continue
      if (existing.requestedQuantity > 0) {
        await tx.orderItem.update({ where: { id: existing.id }, data: { quantity: 0 } })
      } else {
        await tx.orderItem.delete({ where: { id: existing.id } })
      }
    }

    const existingExtraById = new Map(order.extraItems.map((e) => [e.id, e]))
    const incomingExtraIds = new Set(extraEntries.filter((e) => e.id).map((e) => e.id!))

    for (const entry of extraEntries) {
      if (entry.id) {
        await tx.orderExtraItem.update({ where: { id: entry.id }, data: { quantity: entry.quantity! } })
      } else {
        await tx.orderExtraItem.create({
          data: { orderId: id, name: entry.name!.trim(), quantity: entry.quantity!, requestedQuantity: 0 },
        })
      }
    }
    for (const existing of order.extraItems) {
      if (incomingExtraIds.has(existing.id)) continue
      if (existing.requestedQuantity > 0) {
        await tx.orderExtraItem.update({ where: { id: existing.id }, data: { quantity: 0 } })
      } else {
        await tx.orderExtraItem.delete({ where: { id: existing.id } })
      }
    }

    await tx.order.update({ where: { id }, data: { status: order.status } })
  })

  const updated = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  res.json(updated)
}

export async function updateOwnOrder(req: Request, res: Response) {
  const id = req.params.id
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Id do pedido inválido' })
    return
  }

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (order.requestedById !== req.auth!.sub) {
    res.status(403).json({ error: 'Você só pode editar pedidos feitos por você' })
    return
  }
  if (order.status !== OrderStatus.RECEBIDO) {
    res.status(400).json({ error: 'Só é possível editar o pedido enquanto ele está em Recebido' })
    return
  }

  const { branchId, items, extras } = req.body as {
    branchId?: number
    items?: { itemId?: string; quantity?: number }[]
    extras?: { name?: string; quantity?: number }[]
  }

  let nextBranchId = order.branchId
  if (branchId !== undefined) {
    if (!Number.isInteger(branchId)) {
      res.status(400).json({ error: 'Informe uma filial válida' })
      return
    }
    const allowedBranchIds = req.auth!.branchs.map((b) => b.id)
    if (!allowedBranchIds.includes(branchId)) {
      res.status(403).json({ error: 'Filial informada não está liberada para este usuário' })
      return
    }
    nextBranchId = branchId
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

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } })
    await tx.orderExtraItem.deleteMany({ where: { orderId: id } })
    await tx.order.update({
      where: { id },
      data: {
        branchId: nextBranchId,
        items: {
          create: (items ?? []).map((entry) => ({
            itemId: entry.itemId!,
            quantity: entry.quantity!,
            requestedQuantity: entry.quantity!,
          })),
        },
        extraItems: {
          create: validExtras.map((entry) => ({
            name: entry.name!.trim(),
            quantity: entry.quantity!,
            requestedQuantity: entry.quantity!,
          })),
        },
      },
    })
  })

  const updated = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
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
