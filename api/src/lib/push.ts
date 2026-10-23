import webpush from 'web-push'
import { prisma } from './prisma'
import type { Prisma } from '../generated/prisma/client'

// Sem as chaves VAPID no .env as notificações ficam desligadas e o resto funciona normalmente.
const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT ?? 'mailto:suporte@lojanovamix.com.br'

export const pushEnabled = Boolean(publicKey && privateKey)
if (pushEnabled) webpush.setVapidDetails(subject, publicKey!, privateKey!)

export function vapidPublicKey(): string | null {
  return pushEnabled ? publicKey! : null
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

async function send(where: Prisma.PushSubscriptionWhereInput, payload: PushPayload) {
  if (!pushEnabled) return
  const subscriptions = await prisma.pushSubscription.findMany({ where })
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
      } catch (err) {
        // 404/410 = o aparelho cancelou a inscrição ou o app foi desinstalado
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    }),
  )
}

function fireAndForget(promise: Promise<void>) {
  promise.catch((err) => console.error('Falha ao enviar notificação push', err))
}

// não seguram a resposta da requisição: a notificação sai em segundo plano
export function notifyAdmins(payload: PushPayload, exceptUserId?: number) {
  fireAndForget(send({ isAdmin: true, ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) }, payload))
}

export function notifyBranch(branchId: number, payload: PushPayload, exceptUserId?: number) {
  fireAndForget(
    send(
      { isAdmin: false, branchIds: { has: branchId }, ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
      payload,
    ),
  )
}
