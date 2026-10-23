// Service worker do app instalado: só recebe e mostra as notificações push.
// Não guarda páginas em cache — cada abertura busca a versão mais nova do site.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Uso e Consumo'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    }),
  )
})

// tocar na notificação abre (ou traz pra frente) o app na tela certa
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus().then((focused) => (focused && 'navigate' in focused ? focused.navigate(url) : focused))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
