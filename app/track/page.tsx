'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatTime, money, normalizePhone } from '@/lib/format'
import { recentOrders, savedCustomer, type RecentOrder } from '@/lib/local'
import type { Fulfillment, OrderStatus } from '@/lib/types'
import { SiteFooter, SiteHeader } from '@/components/site'
import { Badge, Button, Field, inputClass } from '@/components/ui'

interface FoundOrder {
  id: string
  created_at: string
  fulfillment: Fulfillment
  status: OrderStatus
  total: number
  item_count: number
}

function statusText(status: OrderStatus, fulfillment: Fulfillment) {
  const pickup = fulfillment === 'pickup'
  return {
    pending_payment: 'Waiting for payment',
    confirmed: 'Paid',
    preparing: 'Preparing',
    out_for_delivery: pickup ? 'Ready for pickup' : 'On the way',
    delivered: pickup ? 'Picked up' : 'Delivered',
    cancelled: 'Cancelled',
  }[status]
}

const tone = (s: OrderStatus) =>
  s === 'pending_payment' ? 'warn' : s === 'delivered' ? 'ok' : s === 'cancelled' ? 'danger' : s === 'out_for_delivery' ? 'gold' : 'neutral'

export default function TrackPage() {
  const [recent, setRecent] = useState<RecentOrder[]>([])
  const [phone, setPhone] = useState('')
  const [found, setFound] = useState<FoundOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading device storage after mount */
    setRecent(recentOrders())
    setPhone(savedCustomer().phone ?? '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    const clean = normalizePhone(phone)
    if (!clean) return setError('Enter the 10-digit number you ordered with.')
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: clean }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFound(data.orders)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'We couldn’t look that up. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SiteHeader back={{ href: '/', label: 'Menu' }} />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <h1 className="display text-4xl font-semibold sm:text-5xl">Track an order</h1>
        <p className="mt-3 text-lg text-muted">Your order page updates live, from payment to your door.</p>

        {recent.length > 0 && (
          <section aria-labelledby="recent-title" className="mt-10">
            <h2 id="recent-title" className="text-sm font-semibold text-muted">Ordered on this device</h2>
            <ul className="mt-3 flex flex-col divide-y divide-line border-y border-line">
              {recent.map(o => (
                <li key={o.id}>
                  <Link href={`/order/${o.id}`} className="flex min-h-14 items-center justify-between gap-4 py-3 hover:text-gold-ink">
                    <span>{formatTime(o.created_at)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular font-semibold">{money(o.total, { cents: true })}</span>
                      <ChevronRight size={18} strokeWidth={1.75} className="text-muted" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="lookup-title" className="mt-10">
          <h2 id="lookup-title" className="display text-2xl font-semibold">Look up by phone</h2>
          <form onSubmit={lookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
            <Field label="Phone number" error={error} className="flex-1">
              {p => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />}
            </Field>
            <Button type="submit" size="lg" loading={busy} className="sm:mt-7">Find orders</Button>
          </form>

          {found && found.length === 0 && <p className="mt-6 text-muted">No orders on that number yet.</p>}
          {found && found.length > 0 && (
            <ul className="mt-6 flex flex-col divide-y divide-line border-y border-line">
              {found.map(o => (
                <li key={o.id}>
                  <Link href={`/order/${o.id}`} className="flex min-h-16 items-center justify-between gap-4 py-3 hover:text-gold-ink">
                    <span className="flex flex-col gap-1">
                      <span>{formatTime(o.created_at)}</span>
                      <span className="text-sm text-muted">{o.item_count} item{o.item_count === 1 ? '' : 's'} · {o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge tone={tone(o.status)}>{statusText(o.status, o.fulfillment)}</Badge>
                      <ChevronRight size={18} strokeWidth={1.75} className="text-muted" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
