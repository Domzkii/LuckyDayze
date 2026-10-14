'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, Copy, ExternalLink, KeyRound } from 'lucide-react'
import { CASHTAG, ZELLE_PHONE, cashAppLink, formatPhone, formatTime, money, orderCode, weightLabel } from '@/lib/format'
import type { OrderStatus, PublicOrder } from '@/lib/types'
import { InstallCard } from '@/components/install'
import { SiteHeader } from '@/components/site'
import { Button, ButtonLink, IconButton, Notice, Spinner, cx } from '@/components/ui'

const POLL_MS = 15_000
const FINAL: OrderStatus[] = ['delivered', 'cancelled']

function steps(o: PublicOrder) {
  const pickup = o.fulfillment === 'pickup'
  return [
    { status: 'pending_payment', label: 'Placed' },
    { status: 'confirmed', label: o.payment_method === 'cash' ? 'Confirmed' : 'Paid' },
    { status: 'preparing', label: 'Preparing' },
    { status: 'out_for_delivery', label: pickup ? 'Ready' : 'On the way' },
    { status: 'delivered', label: pickup ? 'Picked up' : 'Delivered' },
  ] as const
}

function headline(o: PublicOrder) {
  const pickup = o.fulfillment === 'pickup'
  switch (o.status) {
    case 'pending_payment': return o.payment_method === 'cash'
      ? { title: 'Waiting for approval.', body: `Your cash order is in. We’ll approve it shortly, then have ${money(o.total, { cents: true })} ready${pickup ? ' when you come by' : ' at the door'}.` }
      : { title: `Send ${money(o.total, { cents: true })} to finish.`, body: 'Your order is saved. It goes to the kitchen the moment your payment lands.' }
    case 'confirmed': return o.payment_method === 'cash'
      ? { title: 'Approved.', body: `Thanks, ${o.first_name}. Have ${money(o.total, { cents: true })} in cash ready${pickup ? ' when you come by' : ' at the door'}.` }
      : { title: 'Payment received.', body: `Thanks, ${o.first_name}. We’re lining your order up now.` }
    case 'preparing': return { title: 'We’re getting it ready.', body: pickup ? 'We’ll update this page the moment it’s ready to grab.' : 'A driver heads out as soon as it’s packed.' }
    case 'out_for_delivery': return pickup
      ? { title: 'Ready for pickup.', body: 'Come to my door and tap “I’m at the door” when you get here.' }
      : { title: 'On the way.', body: 'Your driver is headed over. Keep your phone close.' }
    case 'delivered': return { title: pickup ? 'Picked up. Enjoy.' : 'Delivered. Enjoy.', body: 'Points from this order are already on your Lucky Rewards account.' }
    case 'cancelled': return { title: 'This order was cancelled.', body: 'If you already paid, we’ll sort out a refund with you directly.' }
  }
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<PublicOrder | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [placed, setPlaced] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
      if (res.status === 404) return setState('missing')
      if (!res.ok) throw new Error(String(res.status))
      setOrder(await res.json())
      setState('ready')
    } catch {
      setState(prev => (prev === 'ready' ? 'ready' : 'error'))
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load()
    const url = new URL(window.location.href)
    if (url.searchParams.get('placed') === '1') {
      setPlaced(true)
      url.searchParams.delete('placed')
      window.history.replaceState(null, '', url)
    }
  }, [load])

  const done = order ? FINAL.includes(order.status) : false
  useEffect(() => {
    if (done) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [done, load])

  return (
    <>
      <SiteHeader back={{ href: '/', label: 'Menu' }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {state === 'loading' && <Spinner label="Finding your order" />}
        {state === 'missing' && (
          <div className="py-16 text-center">
            <h1 className="display text-3xl font-semibold">We can’t find that order.</h1>
            <p className="mt-3 text-muted">Check the link, or look it up with your phone number.</p>
            <ButtonLink href="/track" className="mt-8">Track an order</ButtonLink>
          </div>
        )}
        {state === 'error' && (
          <div className="py-16 text-center">
            <h1 className="display text-3xl font-semibold">We couldn’t load your order.</h1>
            <p className="mt-3 text-muted">Check your connection and try again.</p>
            <Button variant="outline" className="mt-8" onClick={load}>Try again</Button>
          </div>
        )}
        {state === 'ready' && order && <OrderView order={order} placed={placed} onChange={load} />}
      </main>
    </>
  )
}

function OrderView({ order, placed, onChange }: { order: PublicOrder; placed: boolean; onChange: () => void }) {
  const h = headline(order)
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        {placed && order.status === 'pending_payment' && (
          <p className="flex items-center gap-2 font-semibold text-ok">
            <PlacedMark /> Order placed
          </p>
        )}
        <h1 className="display text-4xl font-semibold leading-[1.05] sm:text-5xl">{h.title}</h1>
        <p className="max-w-lg text-lg text-muted">{h.body}</p>
      </header>

      {order.status === 'pending_payment' && order.payment_method !== 'cash' && (order.payment_method === 'zelle'
        ? <ZelleCard total={order.total} code={orderCode(order.id)} />
        : <PayCard total={order.total} firstName={order.first_name} />)}
      {order.payment_method === 'cash' && !FINAL.includes(order.status) && order.status !== 'confirmed' && (
        <Notice tone="neutral" title={`Paying cash: ${money(order.total, { cents: true })}`}>Exact change helps.</Notice>
      )}
      {order.status !== 'cancelled' && <Timeline order={order} />}
      {order.fulfillment === 'pickup' && <PickupCard order={order} onChange={onChange} />}

      <section aria-labelledby="items-title" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="items-title" className="display text-2xl font-semibold">Order</h2>
          <span className="text-sm text-muted">{formatTime(order.created_at)}</span>
        </div>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex items-baseline justify-between gap-4 py-3">
              <span>
                <span className="font-semibold">{i.name}</span>
                <span className="text-muted"> {[weightLabel(i.weight), `× ${i.qty}`].filter(Boolean).join(' ')}</span>
              </span>
              <span className="tabular">{i.is_reward ? 'Free' : money(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1.5">
          {order.discounts.map(d => (
            <div key={d.label} className="flex justify-between text-ok">
              <dt>{d.label}</dt>
              <dd className="tabular">−{money(d.amount, { cents: true })}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="font-semibold">Total</dt>
            <dd className="tabular display text-2xl font-semibold">{money(order.total, { cents: true })}</dd>
          </div>
        </dl>
      </section>

      <InstallCard />
    </div>
  )
}

/** The order's one authored moment: a gold check that draws itself in. */
function PlacedMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="var(--gold)" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--on-gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="16" strokeDashoffset="16" style={{ animation: 'draw 600ms var(--ease-out-expo) 150ms forwards' }} />
    </svg>
  )
}

function PayCard({ total, firstName }: { total: number; firstName: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <section aria-labelledby="pay-title" className="overflow-hidden rounded-3xl bg-night text-on-night">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <h2 id="pay-title" className="sr-only">Pay with Cash App</h2>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-on-night-muted">Send exactly</p>
            <p className="tabular display text-5xl font-semibold text-gold">{money(total, { cents: true })}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-on-night-muted">to</p>
            <div className="flex items-center gap-1">
              <p className="display text-2xl font-semibold">${CASHTAG}</p>
              <IconButton
                label={copied ? 'Copied' : 'Copy Cashtag'}
                className="text-on-night-muted hover:bg-white/10 hover:text-on-night"
                onClick={() => {
                  navigator.clipboard?.writeText(`$${CASHTAG}`).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1800)
                  }).catch(() => {})
                }}
              >
                {copied ? <Check size={18} strokeWidth={2} /> : <Copy size={18} strokeWidth={1.75} />}
              </IconButton>
            </div>
          </div>
        </div>
        <ButtonLink href={cashAppLink(total)} external variant="gold" size="lg" className="w-full">
          Open Cash App <ExternalLink size={18} strokeWidth={1.75} />
        </ButtonLink>
        <p className="text-sm text-on-night-muted">Put “{firstName}” in the note. This page updates on its own once we see it.</p>
      </div>
    </section>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <IconButton
      label={copied ? 'Copied' : label}
      className="text-on-night-muted hover:bg-white/10 hover:text-on-night"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        }).catch(() => {})
      }}
    >
      {copied ? <Check size={18} strokeWidth={2} /> : <Copy size={18} strokeWidth={1.75} />}
    </IconButton>
  )
}

/** Zelle has no pay link, so the card gives the number and a memo code to copy. */
function ZelleCard({ total, code }: { total: number; code: string }) {
  return (
    <section aria-labelledby="pay-title" className="overflow-hidden rounded-3xl bg-night text-on-night">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <h2 id="pay-title" className="sr-only">Pay with Zelle</h2>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-on-night-muted">Send exactly</p>
            <p className="tabular display text-5xl font-semibold text-gold">{money(total, { cents: true })}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-on-night-muted">on Zelle to</p>
            <div className="flex items-center gap-1">
              <p className="tabular display text-2xl font-semibold">{formatPhone(ZELLE_PHONE)}</p>
              <CopyButton text={ZELLE_PHONE} label="Copy Zelle number" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm text-on-night-muted">Put this in the memo</p>
            <p className="tabular display text-2xl font-semibold tracking-[0.15em]">{code}</p>
          </div>
          <CopyButton text={code} label="Copy memo code" />
        </div>
        <p className="text-sm text-on-night-muted">Open Zelle in your bank’s app. This page updates on its own once we see the payment.</p>
      </div>
    </section>
  )
}

function Timeline({ order }: { order: PublicOrder }) {
  const list = steps(order)
  const current = list.findIndex(s => s.status === order.status)
  const progress = current <= 0 ? 0 : current / (list.length - 1)
  return (
    <section aria-label="Order progress">
      <ol className="relative grid grid-cols-5 gap-1">
        <span aria-hidden className="absolute left-[10%] right-[10%] top-[9px] h-0.5 bg-line" />
        <span
          aria-hidden
          className="absolute left-[10%] top-[9px] h-0.5 origin-left bg-gold transition-transform duration-700 ease-[var(--ease-out-expo)]"
          style={{ width: '80%', transform: `scaleX(${progress})` }}
        />
        {list.map((s, i) => {
          const reached = i <= current
          return (
            <li key={s.status} className="relative flex flex-col items-center gap-2 text-center" aria-current={i === current ? 'step' : undefined}>
              <span className={cx('flex size-5 items-center justify-center rounded-full border-2 transition-colors duration-500', reached ? 'border-gold bg-gold' : 'border-line-strong bg-canvas')}>
                {reached && i < current && <Check size={12} strokeWidth={3} className="text-on-gold" />}
              </span>
              <span className={cx('text-xs font-semibold sm:text-sm', i === current ? 'text-ink' : 'text-muted')}>{s.label}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function PickupCard({ order, onChange }: { order: PublicOrder; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canArrive = ['confirmed', 'preparing', 'out_for_delivery'].includes(order.status) && !order.customer_arrived

  return (
    <section aria-labelledby="pickup-title" className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <KeyRound size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-gold-ink" />
        <div>
          <h2 id="pickup-title" className="text-sm font-semibold text-muted">Pickup</h2>
          <p className="display text-xl font-semibold">At my door</p>
        </div>
      </div>
      {order.customer_arrived && order.status !== 'delivered' && (
        <Notice tone="ok" icon={<Check size={18} strokeWidth={2} />}>We know you’re at the door. Coming now.</Notice>
      )}
      {canArrive && (
        <>
          <Button
            variant="gold"
            size="lg"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              const res = await fetch(`/api/orders/${order.id}/arrived`, { method: 'POST' }).catch(() => null)
              setBusy(false)
              if (!res?.ok) setError('That didn’t go through. Try again, or text us.')
              onChange()
            }}
          >
            I’m at the door
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </>
      )}
    </section>
  )
}
