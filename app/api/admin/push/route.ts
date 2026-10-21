import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/server/auth'
import { pushToStaff } from '@/lib/server/push'
import { InputError, handle, readJson } from '@/lib/server/http'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Staff turn on push alerts for this device. Sends a test alert so they know it works. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireStaff(request)
    const body = await readJson(request)
    const sub = (body.subscription ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
    const endpoint = str(sub.endpoint, 1000)
    const p256dh = str(sub.keys?.p256dh, 200)
    const auth = str(sub.keys?.auth, 200)
    if (!endpoint.startsWith('https://') || !p256dh || !auth) throw new InputError('This device can’t receive alerts.')

    const { error } = await serviceClient().from('push_subscriptions').upsert({
      endpoint, p256dh, auth, user_id: user.id, user_agent: str(request.headers.get('user-agent'), 300) || null,
    })
    if (error) throw error
    if (body.test) await pushToStaff({ title: 'Alerts are on', body: 'You’ll get a notification here for every new order.', tag: 'test' }, endpoint)
    return NextResponse.json({ ok: true })
  })
}

/** Staff turn alerts off for this device. */
export async function DELETE(request: Request) {
  return handle(async () => {
    await requireStaff(request)
    const endpoint = str((await readJson(request)).endpoint, 1000)
    if (endpoint) await serviceClient().from('push_subscriptions').delete().eq('endpoint', endpoint)
    return NextResponse.json({ ok: true })
  })
}
