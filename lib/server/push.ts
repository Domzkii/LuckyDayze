import webpush from 'web-push'
import { serviceClient } from '@/lib/supabase/server'

interface StaffPush {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Pushes an alert to every staff device that turned alerts on, or just one device when `endpoint` is given.
 * Never throws: a failed push must not fail the order.
 */
export async function pushToStaff(message: StaffPush, endpoint?: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return

  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@zousaku.com', publicKey, privateKey)
    const db = serviceClient()
    let query = db.from('push_subscriptions').select('endpoint, p256dh, auth')
    if (endpoint) query = query.eq('endpoint', endpoint)
    const { data } = await query
    const payload = JSON.stringify({ url: '/admin', ...message })
    await Promise.all((data ?? []).map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 })
      } catch (err) {
        // 404/410: the phone turned alerts off or the app was deleted. Forget it.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        else console.error('Push failed', status, err)
      }
    }))
  } catch (err) {
    console.error('Push failed', err)
  }
}
