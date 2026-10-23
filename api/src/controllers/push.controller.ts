import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { branchIdsOf, isAdmin, userIdOf } from '../lib/access'
import { pushEnabled, vapidPublicKey } from '../lib/push'

export function getPushConfig(_req: Request, res: Response) {
  res.json({ enabled: pushEnabled, publicKey: vapidPublicKey() })
}

/** Inscreve este aparelho: a central recebe pedidos novos, a filial recebe o andamento dos dela. */
export async function subscribe(req: Request, res: Response) {
  if (!pushEnabled) {
    res.status(503).json({ error: 'Notificações não configuradas no servidor' })
    return
  }
  const { subscription } = req.body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  }
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: 'Inscrição inválida' })
    return
  }

  const data = { p256dh, auth, userId: userIdOf(req), isAdmin: isAdmin(req), branchIds: branchIdsOf(req) }
  await prisma.pushSubscription.upsert({ where: { endpoint }, update: data, create: { endpoint, ...data } })
  res.status(204).send()
}

export async function unsubscribe(req: Request, res: Response) {
  const { endpoint } = req.body as { endpoint?: string }
  if (!endpoint) {
    res.status(400).json({ error: 'Informe o endpoint' })
    return
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: userIdOf(req) } })
  res.status(204).send()
}
