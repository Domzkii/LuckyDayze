'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Check, DoorOpen, KeyRound } from 'lucide-react'
import {
  CASHTAG, FREQUENCIES, MAX_SCHEDULE_DAYS, PAYMENT_METHODS, TIME_WINDOWS, ZELLE_PHONE, formatDay, formatPhone, money, normalizePhone,
  todayInStore, weightLabel,
} from '@/lib/format'
import { perkNudge, quote } from '@/lib/pricing'
import { REFERRAL_GIFTS, type ReferralChoice } from '@/lib/rewards'
import { rememberOrder, saveCustomer, savedCustomer } from '@/lib/local'
import { useCatalog } from '@/lib/use-catalog'
import { authHeaders, useAccount } from '@/lib/use-account'
import type { Frequency, Fulfillment, PaymentMethod, PublicRewards } from '@/lib/types'
import { useCart } from '@/components/cart'
import { CartThumb } from '@/components/cart-drawer'
import { SiteHeader } from '@/components/site'
import { Button, ButtonLink, ChoiceCard, Field, Notice, Segmented, Spinner, cx, inputClass } from '@/components/ui'

function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

type Errors = Partial<Record<'fulfillment' | 'name' | 'phone' | 'cashTag' | 'address' | 'date' | 'referral' | 'form', string>>

export default function CheckoutPage() {
  const router = useRouter()
  const { products, settings, sale, status } = useCatalog()
  const { lines, ready, clear } = useCart()
  const signedIn = useAccount()
  const me = signedIn.status === 'signed-in' ? signedIn.account : null
  const friend = me?.kind === 'friend'

  const open = settings?.is_open ?? true
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null)
  const method: Fulfillment = fulfillment ?? (open ? 'delivery' : 'pickup')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('cashapp')
  const [cashTag, setCashTag] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [timeWindow, setTimeWindow] = useState<string | null>(null)
  const [frequency, setFrequency] = useState<Frequency>('once')
  const [showReferral, setShowReferral] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralChoice, setReferralChoice] = useState<ReferralChoice | null>(null)
  const [account, setAccount] = useState<PublicRewards | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [scheduled, setScheduled] = useState<{ date: string; total: number } | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Prefill from the last order on this device.
  useEffect(() => {
    const saved = savedCustomer()
    /* eslint-disable react-hooks/set-state-in-effect -- one-time prefill from device storage */
    if (saved.name) setName(saved.name)
    if (saved.phone) setPhone(saved.phone)
    if (saved.cashTag) setCashTag(saved.cashTag)
    if (saved.payment && PAYMENT_METHODS.some(m => m.value === saved.payment)) setPayment(saved.payment)
    if (saved.address) setAddress(saved.address)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // A signed-in account's details win over what this device remembers.
  useEffect(() => {
    if (!me) return
    /* eslint-disable react-hooks/set-state-in-effect -- prefill from the account once it loads */
    setName(me.name)
    setPhone(me.phone)
    setAddress((me.kind === 'friend' ? me.street_address : me.apt) ?? '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [me])

  // Recognize returning customers to show their points and any banked credit.
  const cleanPhone = normalizePhone(phone)
  useEffect(() => {
    if (!cleanPhone) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch('/api/rewards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: cleanPhone }), signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : null))
        .then(data => setAccount(data))
        .catch(() => {})
    }, 400)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [cleanPhone])
  const knownAccount = cleanPhone ? account : null

  const today = todayInStore()
  const banked = method !== 'scheduled' ? knownAccount?.next_order_credit ?? 0 : 0

  // One deal per order: the spend perk competes with promos and banked credit.
  // lib/pricing picks whichever is worth most to the customer (the server does the same).
  const special = me?.prices ?? null
  const priced = useMemo(() => quote(lines, products, { sale, credit: banked, special }), [lines, products, sale, banked, special])
  const minimum = Number(settings?.delivery_minimum ?? 30)
  const short = method !== 'pickup' ? minimum - priced.merchandise : 0

  function validate(): Errors {
    const e: Errors = {}
    if (method === 'delivery' && !open) e.fulfillment = 'Delivery is closed right now. Choose pickup or schedule it for later.'
    if (name.trim().length < 2) e.name = 'Enter your name.'
    if (!cleanPhone) e.phone = 'Enter a 10-digit US phone number.'
    if (payment === 'cashapp' && !/^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(cashTag.replace(/^\$/, '').trim())) e.cashTag = 'Enter your Cash App $Cashtag, like $JaneDoe.'
    if (method !== 'pickup' && !address.trim()) e.address = friend ? 'Enter your street address.' : 'Enter your apartment number.'
    if (method === 'scheduled' && !date) e.date = 'Choose a delivery date.'
    if (showReferral && referralCode.trim() && !referralChoice) e.referral = 'Choose your free pre-roll, or save it for later.'
    if (short > 0) e.form = `Delivery starts at ${money(minimum)}. Add ${money(short, { cents: true })} more, or switch to pickup.`
    return e
  }

  // After the first attempt, errors track the fields live so they clear as they're fixed.
  const errors: Errors = { ...(attempted ? validate() : {}), ...(serverError ? { form: serverError } : {}) }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setAttempted(true)
    setServerError(null)
    const e = validate()
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-error]')?.focus())
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          fulfillment: method,
          name: name.trim(),
          phone: cleanPhone,
          paymentMethod: payment,
          cashTag: payment === 'cashapp' ? cashTag.replace(/^\$/, '').trim() : '',
          address: method === 'pickup' ? '' : address.trim(),
          notes: notes.trim(),
          scheduledDate: method === 'scheduled' ? date : null,
          timeWindow: method === 'scheduled' ? timeWindow : null,
          frequency: method === 'scheduled' ? frequency : 'once',
          referralCode: showReferral ? referralCode.trim() : '',
          referralChoice: showReferral ? referralChoice : null,
          lines,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(data.error || 'We couldn’t place your order. Please try again.')
        requestAnimationFrame(() => errorRef.current?.focus())
        return
      }
      saveCustomer({ name: name.trim(), phone: cleanPhone!, payment, cashTag: cashTag.replace(/^\$/, '').trim(), address: method === 'pickup' ? address : address.trim() })
      clear()
      if (data.kind === 'scheduled') {
        setScheduled({ date, total: data.total })
        window.scrollTo({ top: 0 })
      } else {
        rememberOrder({ id: data.id, created_at: new Date().toISOString(), total: data.total })
        router.push(`/order/${data.id}?placed=1`)
      }
    } catch {
      setServerError('We couldn’t reach the shop. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (scheduled) {
    return (
      <>
        <SiteHeader back={{ href: '/', label: 'Menu' }} />
        <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-gold text-on-gold"><Check size={26} strokeWidth={2} /></span>
          <h1 className="display mt-6 text-4xl font-semibold">You’re on the schedule.</h1>
          <p className="mt-4 text-lg text-muted">
            We’ll text you to confirm your delivery for <span className="font-semibold text-ink">{formatDay(scheduled.date)}</span>.
            {payment === 'cash'
              ? <>Have <span className="tabular font-semibold text-ink">{money(scheduled.total, { cents: true })}</span> in cash ready on the day.</>
              : <>Pay <span className="tabular font-semibold text-ink">{money(scheduled.total, { cents: true })}</span> {payment === 'zelle' ? `on Zelle to ${formatPhone(ZELLE_PHONE)}` : `to $${CASHTAG}`} when we confirm.</>}
          </p>
          <ButtonLink href="/" size="lg" className="mt-10">Back to the menu</ButtonLink>
        </main>
      </>
    )
  }

  if (!ready || status === 'loading') {
    return (
      <>
        <SiteHeader back={{ href: '/', label: 'Menu' }} />
        <Spinner label="Loading your cart" />
      </>
    )
  }

  if (lines.length === 0) {
    return (
      <>
        <SiteHeader back={{ href: '/', label: 'Menu' }} />
        <main className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
          <h1 className="display text-3xl font-semibold">Your cart is empty.</h1>
          <p className="mt-3 text-muted">Add something from the menu to check out.</p>
          <ButtonLink href="/#menu" size="lg" className="mt-8">Browse the menu</ButtonLink>
        </main>
      </>
    )
  }

  const totalLabel = money(priced.total, { cents: true })

  return (
    <>
      <SiteHeader back={{ href: '/', label: 'Menu' }} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <h1 className="display text-4xl font-semibold sm:text-5xl">Checkout</h1>
        <p className="mt-2 text-muted">Place your order, then pay with Cash App, Zelle or cash.</p>

        <form onSubmit={submit} noValidate className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
          <div className="flex flex-col gap-12">
            {/* How */}
            <section aria-labelledby="how-title" className="flex flex-col gap-4">
              <h2 id="how-title" className="display text-2xl font-semibold">How do you want it?</h2>
              {errors.fulfillment && <p className="text-sm text-danger" data-error tabIndex={-1}>{errors.fulfillment}</p>}
              <div className="flex flex-col gap-3" role="radiogroup" aria-labelledby="how-title">
                <ChoiceCard
                  name="fulfillment"
                  checked={method === 'delivery'}
                  onChange={() => setFulfillment('delivery')}
                  disabled={!open}
                  icon={<DoorOpen size={20} strokeWidth={1.75} />}
                  title="Delivery"
                  detail={open ? `Right to your door · ${money(minimum)} minimum, no delivery fee` : 'Closed right now. Pickup and scheduled are open.'}
                />
                <ChoiceCard
                  name="fulfillment"
                  checked={method === 'pickup'}
                  onChange={() => setFulfillment('pickup')}
                  icon={<KeyRound size={20} strokeWidth={1.75} />}
                  title="Pick up from us"
                  detail="Come to my door when it’s ready. No minimum."
                />
                <ChoiceCard
                  name="fulfillment"
                  checked={method === 'scheduled'}
                  onChange={() => setFulfillment('scheduled')}
                  icon={<CalendarDays size={20} strokeWidth={1.75} />}
                  title="Schedule a delivery"
                  detail="Pick a day, and it can repeat."
                />
              </div>

              {method === 'scheduled' && (
                <div className="mt-2 flex flex-col gap-6">
                  <Field label="Delivery date" error={errors.date}>
                    {p => (
                      <input {...p} type="date" min={today} max={addDays(today, MAX_SCHEDULE_DAYS)} value={date} onChange={e => setDate(e.target.value)} className={cx(inputClass, 'sm:max-w-xs')} />
                    )}
                  </Field>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">Time window <span className="font-normal text-muted">optional</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {TIME_WINDOWS.map(w => (
                        <button
                          key={w}
                          type="button"
                          aria-pressed={timeWindow === w}
                          onClick={() => setTimeWindow(prev => (prev === w ? null : w))}
                          className={cx(
                            'min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors',
                            timeWindow === w ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface hover:border-line-strong',
                          )}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">Repeat</p>
                    <Segmented label="Repeat" value={frequency} onChange={setFrequency} options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} size="sm" />
                  </div>
                </div>
              )}
            </section>

            {/* Who */}
            <section aria-labelledby="who-title" className="flex flex-col gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="who-title" className="display text-2xl font-semibold">Your details</h2>
                {me ? (
                  <Link href="/account" className="text-sm font-semibold text-muted hover:text-ink">Signed in as {me.email}</Link>
                ) : signedIn.status === 'guest' ? (
                  <Link href="/account" className="text-sm font-semibold text-gold-ink hover:text-ink">Have an account? Sign in</Link>
                ) : null}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" error={errors.name}>
                  {p => <input {...p} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} />}
                </Field>
                <Field
                  label="Phone"
                  error={errors.phone}
                  hint={knownAccount ? `Welcome back, ${knownAccount.first_name}. ${knownAccount.points} points.` : 'We text you when it’s on the way.'}
                >
                  {p => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />}
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">How you’ll pay</p>
                <Segmented label="How you’ll pay" value={payment} onChange={setPayment} size="sm" options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))} />
                {payment === 'zelle' && <p className="text-sm text-muted">You’ll get our Zelle number and a memo code after you place the order.</p>}
                {payment === 'cash' && <p className="text-sm text-muted">We approve cash orders first, then you pay {method === 'pickup' ? 'when you pick up' : 'at the door'}.</p>}
              </div>
              {payment === 'cashapp' && (
                <Field label="Cash App $Cashtag" error={errors.cashTag} hint="So we can match your payment to your order.">
                  {p => (
                    <div className="relative sm:max-w-xs">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-muted">$</span>
                      <input {...p} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={cashTag} onChange={e => setCashTag(e.target.value.replace(/^\$/, ''))} className={cx(inputClass, 'pl-8')} />
                    </div>
                  )}
                </Field>
              )}
              {method !== 'pickup' && friend && (
                <Field label="Street address" error={errors.address} hint="Where we deliver. Change it here for just this order.">
                  {p => <input {...p} autoComplete="street-address" maxLength={120} value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />}
                </Field>
              )}
              {method !== 'pickup' && !friend && (
                <Field label="Apartment number" error={errors.address} hint="Your door number, like 4B. We bring it right up.">
                  {p => (
                    <input {...p} autoComplete="address-line2" autoCapitalize="characters" maxLength={20} value={address}
                      onChange={e => setAddress(e.target.value)} className={cx(inputClass, 'sm:max-w-xs')} />
                  )}
                </Field>
              )}
              <Field label="Notes for us" optional hint="Ask us about deals here.">
                {p => <textarea {...p} rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cx(inputClass, 'min-h-20 py-3')} />}
              </Field>

              {!showReferral ? (
                <button type="button" onClick={() => setShowReferral(true)} className="self-start text-sm font-semibold text-gold-ink underline underline-offset-4 hover:text-ink">
                  Have a friend’s referral code?
                </button>
              ) : (
                <div className="flex flex-col gap-4 rounded-2xl border border-line p-4">
                  <Field label="Referral code" error={errors.referral} hint="First orders only. You get 25 bonus points and a free pre-roll.">
                    {p => (
                      <input
                        {...p}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        value={referralCode}
                        onChange={e => setReferralCode(e.target.value.toUpperCase())}
                        className={cx(inputClass, 'font-semibold uppercase tracking-[0.2em] sm:max-w-xs')}
                      />
                    )}
                  </Field>
                  {referralCode.trim() && (
                    <Segmented
                      label="Your free pre-roll"
                      value={referralChoice}
                      onChange={setReferralChoice}
                      size="sm"
                      options={[
                        { value: 'grabba', label: 'With Grabba' },
                        { value: 'plain', label: 'No Grabba' },
                        { value: 'later', label: 'Save for later' },
                      ]}
                    />
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Review */}
          <aside aria-labelledby="review-title" className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <h2 id="review-title" className="display text-2xl font-semibold">Your order</h2>
                <Link href="/?cart=1" className="text-sm font-semibold text-gold-ink hover:text-ink">Edit</Link>
              </div>
              <ul className="flex flex-col gap-4">
                {priced.lines.map(l => (
                  <li key={l.key} className="flex items-center gap-3">
                    <CartThumb image={l.image} reward={!!l.rewardKey} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{l.name}</p>
                      <p className="text-sm text-muted">{l.rewardKey ? 'Reward' : [weightLabel(l.weight), `× ${l.qty}`].filter(Boolean).join(' ')}</p>
                    </div>
                    <span className="tabular font-semibold">{l.rewardKey ? 'Free' : money(l.lineTotal)}</span>
                  </li>
                ))}
                {showReferral && referralCode.trim() && referralChoice && referralChoice !== 'later' && (
                  <li className="flex items-center gap-3">
                    <CartThumb image={null} reward />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{REFERRAL_GIFTS[referralChoice]}</p>
                      <p className="text-sm text-muted">Referral gift, if the code checks out</p>
                    </div>
                    <span className="tabular font-semibold">Free</span>
                  </li>
                )}
              </ul>
              <dl className="flex flex-col gap-2 border-t border-line pt-4 text-[15px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="tabular">{money(priced.subtotal, { cents: true })}</dd>
                </div>
                {priced.discounts.map(d => (
                  <div key={d.label} className="flex justify-between gap-4 text-ok">
                    <dt>{d.label}</dt>
                    <dd className="tabular">−{money(d.amount, { cents: true })}</dd>
                  </div>
                ))}
                <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-semibold">Total</dt>
                  <dd className="tabular display text-3xl font-semibold">{totalLabel}</dd>
                </div>
              </dl>

              {priced.deal && priced.passedOver.length > 0 && (
                <p className="text-sm text-muted">
                  {priced.deal.kind === 'special'
                    ? 'One deal per order. Your prices beat the other deals, so they’re the one applied.'
                    : `One deal per order. ${priced.deal.label} is your best one, so it’s the one applied.`}
                </p>
              )}
              {/* Special prices usually beat the spend perks, so the nudge would only mislead. */}
              {!special && perkNudge(priced.merchandise) && <p className="text-sm text-gold-ink">{perkNudge(priced.merchandise)}</p>}

              {errors.form && (
                <div ref={errorRef} tabIndex={-1} data-error>
                  <Notice tone="danger">{errors.form}</Notice>
                </div>
              )}

              <Button type="submit" size="lg" loading={submitting} className="w-full">
                {method === 'scheduled' ? 'Schedule delivery' : 'Place order'} · {totalLabel}
              </Button>
              <p className="text-center text-sm text-muted">
                {method === 'scheduled'
                  ? 'Nothing to pay yet. We’ll text to confirm before your day.'
                  : payment === 'cash'
                    ? `You’ll pay ${totalLabel} in cash ${method === 'pickup' ? 'at pickup' : 'at the door'}.`
                    : `Next you’ll pay ${totalLabel} ${payment === 'zelle' ? 'on Zelle' : `to $${CASHTAG} on Cash App`}.`}
              </p>
            </div>
          </aside>
        </form>
      </main>
    </>
  )
}
