// Back office push alerts. Registered only from /admin, so customers never get it.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(data.title || 'LuckyDayze', {
    body: data.body || '',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: data.tag,
    data: { url: data.url || '/admin' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/admin', self.location.origin).href
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const admin = open.find(c => new URL(c.url).pathname.startsWith('/admin'))
    if (admin) { await admin.focus(); return admin.navigate(url) }
    return self.clients.openWindow(url)
  })())
})
