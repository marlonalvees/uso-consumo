import { api } from './api'

export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'on' | 'off'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    // sem service worker o site funciona normalmente, só não recebe push
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const config = await api.get<{ enabled: boolean }>('/push/config').catch(() => ({ enabled: false }))
  if (!config.enabled) return 'unavailable'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'on' : 'off'
}

/** Pede permissão e inscreve este aparelho. No iPhone, só funciona com o app na tela inicial. */
export async function enablePush(): Promise<PushState> {
  const config = await api.get<{ enabled: boolean; publicKey: string | null }>('/push/config')
  if (!config.enabled || !config.publicKey) return 'unavailable'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  await registerServiceWorker()
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    }))
  await api.post('/push/subscribe', { subscription: subscription.toJSON() })
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {})
    await subscription.unsubscribe()
  }
  return 'off'
}

/** Notificação local (sem servidor), usada pela central com o site aberto em segundo plano. */
export function showLocalNotification(title: string, body: string, url = '/') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  navigator.serviceWorker
    ?.getRegistration()
    .then((registration) => {
      if (registration) return registration.showNotification(title, { body, icon: '/icons/icon-192.png', data: { url }, tag: 'pedido-novo' })
      new Notification(title, { body, icon: '/icons/icon-192.png' })
    })
    .catch(() => {})
}
