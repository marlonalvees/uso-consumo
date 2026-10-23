import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { OrderEventType, OrderStatus, Prisma, ReceiptIssue, StockMovementType } from '../generated/prisma/client'
import { branchIdsOf, canAccessBranch, isAdmin, trimOrNull, userIdOf } from '../lib/access'
import { notifyAdmins, notifyBranch } from '../lib/push'
import { listPendingItems as findPendingItems } from '../lib/pending'
import { deleteUploadedFile, uploadErrorMessage, uploadReceiptPhoto } from '../middlewares/upload'

const ORDER_INCLUDE = {
  branch: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
  items: { include: { item: { include: { category: true, packaging: true } } }, orderBy: { id: 'asc' } },
  extraItems: { orderBy: { id: 'asc' } },
} as const satisfies Prisma.OrderInclude

// "Aberto" = a central ainda não enviou. Enquanto a filial tem um pedido aberto, ela adiciona
// itens a ele (em Recebido) em vez de criar outro.
const OPEN_STATUSES: OrderStatus[] = [OrderStatus.RECEBIDO, OrderStatus.EM_ANDAMENTO]

const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.RECEBIDO]: [OrderStatus.EM_ANDAMENTO],
  // voltar pra Recebido é o "desfazer" do início da separação
  [OrderStatus.EM_ANDAMENTO]: [OrderStatus.ENVIADO, OrderStatus.RECEBIDO],
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEBIDO: 'Recebido',
  EM_ANDAMENTO: 'Em separação',
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

const BRANCH_STATUS_PUSH: Partial<Record<OrderStatus, (branch: string) => { title: string; body: string }>> = {
  [OrderStatus.EM_ANDAMENTO]: (branch) => ({
    title: 'Pedido em separação',
    body: `A central começou a separar o pedido da filial ${branch}.`,
  }),
  [OrderStatus.ENVIADO]: (branch) => ({
    title: 'Pedido enviado',
    body: `O pedido da filial ${branch} saiu da central. Confirme o recebimento quando chegar.`,
  }),
}

function loadOrder(id: string) {
  return prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE })
}

function readId(req: Request, res: Response, param = 'id'): string | null {
  const id = req.params[param]
  if (typeof id !== 'string' || !id) {
    res.status(400).json({ error: 'Id inválido' })
    return null
  }
  return id
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

interface ItemLine {
  itemId: string
  quantity: number
}

interface ExtraLine {
  name: string
  quantity: number
}

/** Valida os itens de um pedido novo ou editado pela filial: quantidades > 0, sem repetição. */
async function parseOrderLines(
  body: { items?: unknown; extras?: unknown },
): Promise<{ items: ItemLine[]; extras: ExtraLine[] } | { error: string }> {
  const rawItems = Array.isArray(body.items) ? (body.items as { itemId?: unknown; quantity?: unknown }[]) : []
  const rawExtras = Array.isArray(body.extras) ? (body.extras as { name?: unknown; quantity?: unknown }[]) : []

  const items: ItemLine[] = []
  for (const entry of rawItems) {
    if (typeof entry.itemId !== 'string' || !Number.isInteger(entry.quantity) || (entry.quantity as number) <= 0) {
      return { error: 'Cada item precisa de itemId e quantity (inteiro > 0)' }
    }
    items.push({ itemId: entry.itemId, quantity: entry.quantity as number })
  }

  const extras: ExtraLine[] = []
  for (const entry of rawExtras) {
    if (typeof entry.name !== 'string' || !entry.name.trim()) continue
    if (!Number.isInteger(entry.quantity) || (entry.quantity as number) <= 0) {
      return { error: 'Cada item extra precisa de nome e quantity (inteiro > 0)' }
    }
    extras.push({ name: entry.name.trim(), quantity: entry.quantity as number })
  }

  if (items.length === 0 && extras.length === 0) return { error: 'Informe ao menos um item no pedido' }

  const itemIds = items.map((line) => line.itemId)
  if (new Set(itemIds).size !== itemIds.length) return { error: 'O mesmo produto aparece mais de uma vez no pedido' }
  if (itemIds.length) {
    const existing = await prisma.item.count({ where: { id: { in: itemIds } } })
    if (existing !== itemIds.length) return { error: 'Um ou mais itens informados não existem' }
  }

  return { items, extras }
}

/** Marca como resolvidas as pendências que a filial reaproveitou no pedido. */
async function resolvePending(tx: Prisma.TransactionClient, branchId: number, ids: unknown) {
  if (!Array.isArray(ids) || ids.length === 0) return
  const validIds = ids.filter((id): id is string => typeof id === 'string')
  if (!validIds.length) return
  await tx.orderItem.updateMany({
    where: { id: { in: validIds }, pendingResolvedAt: null, order: { branchId } },
    data: { pendingResolvedAt: new Date() },
  })
}

async function findOpenOrder(branchId: number, excludeOrderId?: string) {
  return prisma.order.findFirst({
    where: { branchId, status: { in: OPEN_STATUSES }, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
    select: { id: true, status: true },
  })
}

function openOrderConflict(res: Response, open: { id: string; status: OrderStatus }) {
  res.status(409).json({
    error:
      open.status === OrderStatus.RECEBIDO
        ? 'A filial já tem um pedido aberto. Adicione os itens a ele.'
        : 'A central já está separando o pedido aberto da filial. Dá pra fazer outro quando ele for enviado.',
    openOrderId: open.id,
    openOrderStatus: open.status,
  })
}

export async function createOrder(req: Request, res: Response) {
  const body = req.body as {
    branchId?: number
    items?: unknown
    extras?: unknown
    notes?: string
    resolvePendingIds?: unknown
  }
  const branchId = body.branchId

  if (!Number.isInteger(branchId)) {
    res.status(400).json({ error: 'Informe uma filial válida' })
    return
  }

  if (isAdmin(req)) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId as number } })
    if (!branch) {
      res.status(400).json({ error: 'Filial informada não existe' })
      return
    }
  } else {
    if (!branchIdsOf(req).includes(branchId as number)) {
      res.status(403).json({ error: 'Filial informada não está liberada para este usuário' })
      return
    }
    // o admin faz pedidos pra várias filiais e não tem a trava
    const open = await findOpenOrder(branchId as number)
    if (open) {
      openOrderConflict(res, open)
      return
    }
  }

  const lines = await parseOrderLines(body)
  if ('error' in lines) {
    res.status(400).json({ error: lines.error })
    return
  }

  const userId = userIdOf(req)
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        branchId: branchId as number,
        requestedById: userId,
        notes: trimOrNull(body.notes),
        items: {
          create: lines.items.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            requestedQuantity: line.quantity,
          })),
        },
        extraItems: {
          create: lines.extras.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            requestedQuantity: line.quantity,
          })),
        },
        events: { create: { type: OrderEventType.CRIADO, toStatus: OrderStatus.RECEBIDO, userId } },
      },
      include: ORDER_INCLUDE,
    })
    await resolvePending(tx, branchId as number, body.resolvePendingIds)
    return created
  })

  const count = lines.items.length + lines.extras.length
  notifyAdmins(
    {
      title: 'Novo pedido',
      body: `${order.branch.name} · ${plural(count, 'item', 'itens')}`,
      url: '/administracao',
      tag: `pedido-${order.id}`,
    },
    userId,
  )

  res.status(201).json(order)
}

export async function listOrders(req: Request, res: Response) {
  const where: Prisma.OrderWhereInput = isAdmin(req) ? {} : { branchId: { in: branchIdsOf(req) } }

  // atualização incremental: o front busca só o que mudou desde a última vez
  const updatedSince = typeof req.query.updatedSince === 'string' ? new Date(req.query.updatedSince) : null
  if (updatedSince && !Number.isNaN(updatedSince.getTime())) where.updatedAt = { gte: updatedSince }

  const orders = await prisma.order.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })

  res.json(orders)
}

export async function listOrderEvents(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  const order = await prisma.order.findUnique({ where: { id }, select: { branchId: true } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (!canAccessBranch(req, order.branchId)) {
    res.status(403).json({ error: 'Esse pedido não pertence a uma filial liberada para você' })
    return
  }

  const events = await prisma.orderEvent.findMany({
    where: { orderId: id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(events)
}

export async function updateOrderStatus(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return
  const { status } = req.body as { status?: string }

  if (!status || !(status in OrderStatus)) {
    res.status(400).json({ error: 'status inválido' })
    return
  }
  const nextStatus = status as OrderStatus

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { item: true } }, branch: true },
  })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }

  const allowed = ADMIN_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(nextStatus)) {
    res.status(400).json({
      error: `Não dá para mudar o pedido de ${STATUS_LABELS[order.status]} para ${STATUS_LABELS[nextStatus]}`,
    })
    return
  }

  const userId = userIdOf(req)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    if (nextStatus === OrderStatus.ENVIADO) {
      // o envio não confere o saldo de propósito: o estoque pode ficar negativo
      const alreadyShipped = await tx.stockMovement.findFirst({
        where: { orderId: id, type: StockMovementType.SAIDA },
      })
      for (const orderItem of order.items) {
        if (!alreadyShipped && orderItem.quantity > 0) {
          await tx.stockMovement.create({
            data: {
              itemId: orderItem.itemId,
              type: StockMovementType.SAIDA,
              quantity: orderItem.quantity,
              reason: 'Pedido enviado',
              orderId: id,
              createdById: userId,
            },
          })
          await tx.item.update({
            where: { id: orderItem.itemId },
            data: { stockQuantity: { decrement: orderItem.quantity } },
          })
        }
        // o custo fica guardado no envio: o consumo do mês não muda quando o preço muda depois
        if (orderItem.unitCost === null) {
          await tx.orderItem.update({ where: { id: orderItem.id }, data: { unitCost: orderItem.item.price } })
        }
      }
    }

    await tx.order.update({
      where: { id },
      data: {
        status: nextStatus,
        statusChangedAt: now,
        ...(nextStatus === OrderStatus.ENVIADO ? { sentAt: now } : {}),
      },
    })
    await tx.orderEvent.create({
      data: { orderId: id, type: OrderEventType.STATUS, fromStatus: order.status, toStatus: nextStatus, userId },
    })
  })

  const pushFor = BRANCH_STATUS_PUSH[nextStatus]
  if (pushFor) notifyBranch(order.branchId, { ...pushFor(order.branch.name), url: '/pedidos', tag: `pedido-${id}` })

  res.json(await loadOrder(id))
}

export async function cancelOrder(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return
  const reason = trimOrNull((req.body as { reason?: string }).reason)

  const order = await prisma.order.findUnique({ where: { id }, include: { branch: true } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (!canAccessBranch(req, order.branchId)) {
    res.status(403).json({ error: 'Esse pedido não pertence a uma filial liberada para você' })
    return
  }

  const admin = isAdmin(req)
  const cancellable: OrderStatus[] = admin ? OPEN_STATUSES : [OrderStatus.RECEBIDO]
  if (!cancellable.includes(order.status)) {
    res.status(400).json({
      error: admin
        ? 'Só dá para cancelar um pedido antes de ele ser enviado'
        : 'Só dá para cancelar enquanto o pedido está em Recebido. Depois disso, fale com a central.',
    })
    return
  }
  if (admin && !reason) {
    res.status(400).json({ error: 'Informe o motivo do cancelamento' })
    return
  }

  const userId = userIdOf(req)
  const now = new Date()
  await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELADO,
        statusChangedAt: now,
        cancelledAt: now,
        cancelReason: reason,
        cancelledById: userId,
      },
    }),
    prisma.orderEvent.create({
      data: {
        orderId: id,
        type: OrderEventType.CANCELADO,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELADO,
        userId,
        note: reason,
      },
    }),
  ])

  if (admin) {
    notifyBranch(order.branchId, {
      title: 'Pedido cancelado',
      body: `A central cancelou o pedido da filial ${order.branch.name}: ${reason}`,
      url: '/pedidos',
      tag: `pedido-${id}`,
    })
  } else {
    notifyAdmins(
      { title: 'Pedido cancelado pela filial', body: `${order.branch.name} cancelou o pedido.`, url: '/administracao' },
      userId,
    )
  }

  res.json(await loadOrder(id))
}

export async function updateOrderFulfillment(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  const { items, extras, adminNotes } = req.body as {
    items?: { itemId?: string; quantity?: number; adjustReason?: string | null }[]
    extras?: { id?: string; name?: string; quantity?: number; adjustReason?: string | null }[]
    adminNotes?: string | null
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, extraItems: true, branch: true },
  })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (order.status === OrderStatus.CANCELADO) {
    res.status(400).json({ error: 'Pedido cancelado não pode ser alterado' })
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

  const requestedItemIds = itemEntries.map((e) => e.itemId!)
  if (new Set(requestedItemIds).size !== requestedItemIds.length) {
    res.status(400).json({ error: 'O mesmo produto aparece mais de uma vez' })
    return
  }
  const catalogItemById = new Map<string, { id: string; price: number }>()
  if (requestedItemIds.length) {
    const existingCatalogItems = await prisma.item.findMany({
      where: { id: { in: requestedItemIds } },
      select: { id: true, price: true },
    })
    if (existingCatalogItems.length !== requestedItemIds.length) {
      res.status(400).json({ error: 'Um ou mais itens informados não existem no catálogo' })
      return
    }
    for (const catalogItem of existingCatalogItems) catalogItemById.set(catalogItem.id, catalogItem)
  }

  const existingExtraIds = new Set(order.extraItems.map((e) => e.id))
  for (const entry of extraEntries) {
    if (entry.id && !existingExtraIds.has(entry.id)) {
      res.status(400).json({ error: 'Um item extra informado não pertence a este pedido' })
      return
    }
  }

  // pedidos Enviado/Entregue já tiveram o estoque baixado — mudanças de quantidade agora
  // devolvem ou baixam a diferença (sem conferir saldo, como no envio)
  const stockAlreadyDeducted = order.status === OrderStatus.ENVIADO || order.status === OrderStatus.ENTREGUE
  const userId = userIdOf(req)

  await prisma.$transaction(async (tx) => {
    const existingByItemId = new Map(order.items.map((oi) => [oi.itemId, oi]))
    const incomingItemIds = new Set(requestedItemIds)

    async function adjustStock(itemId: string, oldQty: number, newQty: number) {
      const delta = newQty - oldQty
      if (!stockAlreadyDeducted || delta === 0) return
      if (delta > 0) {
        await tx.stockMovement.create({
          data: { itemId, type: StockMovementType.SAIDA, quantity: delta, reason: 'Ajuste de pedido', orderId: id, createdById: userId },
        })
        await tx.item.update({ where: { id: itemId }, data: { stockQuantity: { decrement: delta } } })
      } else {
        await tx.stockMovement.create({
          data: {
            itemId,
            type: StockMovementType.ENTRADA,
            quantity: -delta,
            reason: 'Ajuste de pedido (redução de quantidade)',
            orderId: id,
            createdById: userId,
          },
        })
        await tx.item.update({ where: { id: itemId }, data: { stockQuantity: { increment: -delta } } })
      }
    }

    for (const entry of itemEntries) {
      const existing = existingByItemId.get(entry.itemId!)
      const quantity = entry.quantity!
      await adjustStock(entry.itemId!, existing?.quantity ?? 0, quantity)
      if (existing) {
        await tx.orderItem.update({
          where: { id: existing.id },
          data: {
            quantity,
            adjustReason: quantity === existing.requestedQuantity ? null : trimOrNull(entry.adjustReason),
          },
        })
      } else {
        await tx.orderItem.create({
          data: {
            orderId: id,
            itemId: entry.itemId!,
            quantity,
            requestedQuantity: 0,
            adjustReason: trimOrNull(entry.adjustReason),
            unitCost: stockAlreadyDeducted ? catalogItemById.get(entry.itemId!)!.price : null,
          },
        })
      }
    }
    for (const existing of order.items) {
      if (incomingItemIds.has(existing.itemId)) continue
      await adjustStock(existing.itemId, existing.quantity, 0)
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
        const existing = existingExtraById.get(entry.id)!
        await tx.orderExtraItem.update({
          where: { id: entry.id },
          data: {
            quantity: entry.quantity!,
            adjustReason: entry.quantity === existing.requestedQuantity ? null : trimOrNull(entry.adjustReason),
          },
        })
      } else {
        await tx.orderExtraItem.create({
          data: {
            orderId: id,
            name: entry.name!.trim(),
            quantity: entry.quantity!,
            requestedQuantity: 0,
            adjustReason: trimOrNull(entry.adjustReason),
          },
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

    // também marca o pedido como atualizado (a lista do front busca o que mudou pelo updatedAt)
    await tx.order.update({
      where: { id },
      data: { adminNotes: adminNotes === undefined ? undefined : trimOrNull(adminNotes) },
    })
    await tx.orderEvent.create({ data: { orderId: id, type: OrderEventType.ITENS_AJUSTADOS, userId } })
  })

  notifyBranch(order.branchId, {
    title: 'Pedido ajustado',
    body: `A central ajustou os itens do pedido da filial ${order.branch.name}.`,
    url: '/pedidos',
    tag: `pedido-${id}`,
  })

  res.json(await loadOrder(id))
}

export async function updateOwnOrder(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  // qualquer supervisor da filial pode completar o pedido aberto dela
  if (!canAccessBranch(req, order.branchId)) {
    res.status(403).json({ error: 'Esse pedido não pertence a uma filial liberada para você' })
    return
  }
  if (order.status !== OrderStatus.RECEBIDO) {
    res.status(400).json({ error: 'Só é possível editar o pedido enquanto ele está em Recebido' })
    return
  }

  const body = req.body as {
    branchId?: number
    items?: unknown
    extras?: unknown
    notes?: string | null
    resolvePendingIds?: unknown
  }

  let nextBranchId = order.branchId
  if (body.branchId !== undefined && body.branchId !== order.branchId) {
    if (!Number.isInteger(body.branchId) || !canAccessBranch(req, body.branchId)) {
      res.status(403).json({ error: 'Filial informada não está liberada para este usuário' })
      return
    }
    if (!isAdmin(req)) {
      const open = await findOpenOrder(body.branchId, id)
      if (open) {
        openOrderConflict(res, open)
        return
      }
    }
    nextBranchId = body.branchId
  }

  const lines = await parseOrderLines(body)
  if ('error' in lines) {
    res.status(400).json({ error: lines.error })
    return
  }

  const userId = userIdOf(req)
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } })
    await tx.orderExtraItem.deleteMany({ where: { orderId: id } })
    await tx.order.update({
      where: { id },
      data: {
        branchId: nextBranchId,
        notes: body.notes === undefined ? undefined : trimOrNull(body.notes),
        items: {
          create: lines.items.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            requestedQuantity: line.quantity,
          })),
        },
        extraItems: {
          create: lines.extras.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            requestedQuantity: line.quantity,
          })),
        },
      },
    })
    await tx.orderEvent.create({ data: { orderId: id, type: OrderEventType.EDITADO, userId } })
    await resolvePending(tx, nextBranchId, body.resolvePendingIds)
  })

  res.json(await loadOrder(id))
}

interface ReceiptEntry {
  id?: string
  receivedQuantity?: number
  issue?: string | null
}

function parseReceiptEntries(raw: unknown): Map<string, ReceiptEntry> {
  const map = new Map<string, ReceiptEntry>()
  if (!Array.isArray(raw)) return map
  for (const entry of raw as ReceiptEntry[]) {
    if (typeof entry?.id === 'string') map.set(entry.id, entry)
  }
  return map
}

/** Quantidade recebida e o problema apontado; sem problema informado, falta vira FALTOU. */
function resolveReceipt(
  sent: number,
  entry: ReceiptEntry | undefined,
): { receivedQuantity: number; receiptIssue: ReceiptIssue | null } | { error: string } {
  const received = entry?.receivedQuantity ?? sent
  if (!Number.isInteger(received) || received < 0 || received > sent) {
    return { error: 'A quantidade recebida deve ficar entre 0 e a quantidade enviada' }
  }
  if (received === sent) return { receivedQuantity: received, receiptIssue: null }
  const issue = entry?.issue === ReceiptIssue.AVARIADO ? ReceiptIssue.AVARIADO : ReceiptIssue.FALTOU
  return { receivedQuantity: received, receiptIssue: issue }
}

export async function confirmDelivery(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, extraItems: true, branch: true },
  })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  if (!canAccessBranch(req, order.branchId)) {
    res.status(403).json({ error: 'Esse pedido não pertence a uma filial liberada para você' })
    return
  }
  if (order.status !== OrderStatus.ENVIADO) {
    res.status(400).json({ error: 'Só é possível confirmar entrega de pedidos enviados' })
    return
  }

  const body = req.body as { items?: unknown; extras?: unknown; notes?: string }
  const itemEntries = parseReceiptEntries(body.items)
  const extraEntries = parseReceiptEntries(body.extras)

  const itemUpdates: { id: string; receivedQuantity: number; receiptIssue: ReceiptIssue | null }[] = []
  for (const orderItem of order.items) {
    const result = resolveReceipt(orderItem.quantity, itemEntries.get(orderItem.id))
    if ('error' in result) {
      res.status(400).json({ error: result.error })
      return
    }
    itemUpdates.push({ id: orderItem.id, ...result })
  }
  const extraUpdates: { id: string; receivedQuantity: number; receiptIssue: ReceiptIssue | null }[] = []
  for (const extra of order.extraItems) {
    const result = resolveReceipt(extra.quantity, extraEntries.get(extra.id))
    if ('error' in result) {
      res.status(400).json({ error: result.error })
      return
    }
    extraUpdates.push({ id: extra.id, ...result })
  }

  const issueCount = [...itemUpdates, ...extraUpdates].filter((u) => u.receiptIssue).length
  const userId = userIdOf(req)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    for (const update of itemUpdates) {
      await tx.orderItem.update({
        where: { id: update.id },
        data: { receivedQuantity: update.receivedQuantity, receiptIssue: update.receiptIssue },
      })
    }
    for (const update of extraUpdates) {
      await tx.orderExtraItem.update({
        where: { id: update.id },
        data: { receivedQuantity: update.receivedQuantity, receiptIssue: update.receiptIssue },
      })
    }
    await tx.order.update({
      where: { id },
      data: {
        status: OrderStatus.ENTREGUE,
        deliveredAt: now,
        statusChangedAt: now,
        receiptNotes: trimOrNull(body.notes),
      },
    })
    await tx.orderEvent.create({
      data: {
        orderId: id,
        type: OrderEventType.RECEBIDO,
        fromStatus: OrderStatus.ENVIADO,
        toStatus: OrderStatus.ENTREGUE,
        userId,
        note: issueCount ? `Recebido com divergência em ${plural(issueCount, 'item', 'itens')}` : null,
      },
    })
  })

  if (issueCount) {
    notifyAdmins(
      {
        title: 'Recebimento com divergência',
        body: `${order.branch.name}: ${plural(issueCount, 'item', 'itens')} com problema.`,
        url: '/administracao',
      },
      userId,
    )
  }

  res.json(await loadOrder(id))
}

export function uploadOrderReceiptPhoto(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return

  uploadReceiptPhoto(req, res, async (err: unknown) => {
    if (err) {
      res.status(400).json({ error: uploadErrorMessage(err) })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'Envie uma imagem no campo "photo"' })
      return
    }

    const relativePath = `recebimentos/${req.file.filename}`
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order || !canAccessBranch(req, order.branchId)) {
      deleteUploadedFile(relativePath)
      res.status(order ? 403 : 404).json({ error: order ? 'Sem permissão para este pedido' : 'Pedido não encontrado' })
      return
    }
    if (order.status !== OrderStatus.ENVIADO && order.status !== OrderStatus.ENTREGUE) {
      deleteUploadedFile(relativePath)
      res.status(400).json({ error: 'A foto do recebimento só pode ser enviada depois do envio' })
      return
    }

    if (order.receiptPhotoPath) deleteUploadedFile(order.receiptPhotoPath)
    await prisma.order.update({ where: { id }, data: { receiptPhotoPath: relativePath } })
    res.json(await loadOrder(id))
  })
}

export async function listPendingItems(req: Request, res: Response) {
  const branchParam = Number(req.query.branchId)
  let branchIds: number[] | undefined
  if (Number.isInteger(branchParam) && branchParam > 0) {
    if (!canAccessBranch(req, branchParam)) {
      res.status(403).json({ error: 'Filial não liberada para você' })
      return
    }
    branchIds = [branchParam]
  } else if (!isAdmin(req)) {
    branchIds = branchIdsOf(req)
  }

  res.json(await findPendingItems(branchIds))
}

export async function dismissPendingItems(req: Request, res: Response) {
  const { ids } = req.body as { ids?: unknown }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: 'Informe a lista de pendências' })
    return
  }

  const result = await prisma.orderItem.updateMany({
    where: {
      id: { in: ids as string[] },
      pendingResolvedAt: null,
      ...(isAdmin(req) ? {} : { order: { branchId: { in: branchIdsOf(req) } } }),
    },
    data: { pendingResolvedAt: new Date() },
  })
  res.json({ resolved: result.count })
}

export async function convertExtraItem(req: Request, res: Response) {
  const id = readId(req, res)
  if (!id) return
  const extraId = readId(req, res, 'extraId')
  if (!extraId) return
  const { itemId } = req.body as { itemId?: string }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, extraItems: true } })
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  // depois do envio o estoque já foi baixado: trocar o extra por um produto mudaria o histórico
  if (!OPEN_STATUSES.includes(order.status)) {
    res.status(400).json({ error: 'Só dá para trocar um item extra por um produto antes do envio' })
    return
  }
  const extra = order.extraItems.find((e) => e.id === extraId)
  if (!extra) {
    res.status(404).json({ error: 'Item extra não encontrado neste pedido' })
    return
  }
  const catalogItem = itemId ? await prisma.item.findUnique({ where: { id: itemId } }) : null
  if (!catalogItem) {
    res.status(400).json({ error: 'Produto informado não existe' })
    return
  }

  const existing = order.items.find((oi) => oi.itemId === catalogItem.id)
  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.orderItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + extra.quantity,
          requestedQuantity: existing.requestedQuantity + extra.requestedQuantity,
        },
      })
    } else {
      await tx.orderItem.create({
        data: {
          orderId: id,
          itemId: catalogItem.id,
          quantity: extra.quantity,
          requestedQuantity: extra.requestedQuantity,
        },
      })
    }
    await tx.orderExtraItem.delete({ where: { id: extraId } })
    await tx.order.update({ where: { id }, data: { status: order.status } })
    await tx.orderEvent.create({
      data: {
        orderId: id,
        type: OrderEventType.ITENS_AJUSTADOS,
        userId: userIdOf(req),
        note: `"${extra.name}" virou o produto "${catalogItem.name}"`,
      },
    })
  })

  res.json(await loadOrder(id))
}
