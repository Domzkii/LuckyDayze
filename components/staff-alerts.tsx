'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { Button, Dialog, Notice } from '@/components/ui'
import { authHeaders } from '@/lib/use-account'
import { installPlatform, isInstalled } from '@/lib/install'

/**
 * Back office push alerts: a new-order notification on this phone even when the app is closed.
 * iPhones only allow push from a site saved to the home screen, so there we explain that first.
 */

type State = 'loading' | 'needs-install' | 'unsupported' | 'blocked' | 'off' | 'on'

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined' && !!VAPID_KEY
}

async function save(subscription: PushSubscription, test: boolean) {
  const res = await fetch('/api/admin/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ subscription: subscription.toJSON(), test }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Couldn’t turn on alerts. Try again.')
}

export function StaffAlerts({ className }: { className: string }) {
  const [state, setState] = useState<State>('loading')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ios = installPlatform().startsWith('ios')
      if (!pushSupported()) return setState(ios && !isInstalled() ? 'needs-install' : 'unsupported')
      if (Notification.permission === 'denied') return setState('blocked')
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.getSubscription()
      // Already on: re-save quietly so the server always has this phone (e.g. after a domain move).
      if (sub && Notification.permission === 'granted') save(sub, false).catch(() => {})
      if (!cancelled) setState(sub && Notification.permission === 'granted' ? 'on' : 'off')
    })().catch(() => !cancelled && setState('unsupported'))
    return () => { cancelled = true }
  }, [])

  async function turnOn() {
    setBusy(true)
    setError(null)
    setSent(false)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) })
      await save(sub, true)
      setState('on')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t turn on alerts. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/admin/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('off')
      setSent(false)
    } catch {
      setError('Couldn’t turn off alerts. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'unsupported') return null

  const on = state === 'on'
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); if (state === 'off') turnOn() }} className={className}>
        {on ? <BellRing size={17} strokeWidth={1.75} aria-hidden /> : <Bell size={17} strokeWidth={1.75} aria-hidden />}
        {on ? 'Alerts on' : 'Turn on alerts'}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Order alerts"
        footer={on ? (
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={turnOff} loading={busy}><BellOff size={16} strokeWidth={1.75} /> Turn off</Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : state === 'off' ? (
          <Button className="w-full" onClick={turnOn} loading={busy}><Bell size={16} strokeWidth={1.75} /> Turn on alerts</Button>
        ) : (
          <Button className="w-full" onClick={() => setOpen(false)}>Got it</Button>
        )}
      >
        <div className="flex flex-col gap-4 text-sm">
          {state === 'needs-install' && (
            <>
              <p>iPhones only send alerts to the back office once it’s saved to your home screen.</p>
              <ol className="flex list-decimal flex-col gap-2 pl-5">
                <li>In Safari, tap the <strong>menu</strong> button, then <strong>Share</strong>.</li>
                <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>. It shows up as <strong>LD Office</strong>.</li>
                <li>Open LD Office from your home screen, sign in, and tap <strong>Turn on alerts</strong>.</li>
              </ol>
            </>
          )}
          {state === 'blocked' && (
            <p>Notifications are blocked for this app. Turn them on in your phone’s Settings → Notifications → LD Office (or your browser’s site settings), then come back.</p>
          )}
          {state === 'off' && <p>Get a notification on this device for every new order, even when the app is closed.</p>}
          {on && (
            <p>This device gets a notification for every new order. {sent && 'We just sent a test one. If it didn’t show up, check that notifications are allowed for this app.'}</p>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Dialog>
    </>
  )
}
