'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Check, DoorOpen, Gift, KeyRound } from 'lucide-react'
import {
  CASHTAG, FREQUENCIES, MAX_SCHEDULE_DAYS, TIME_WINDOWS, formatDay, money, normalizePhone, todayInStore, weightLabel,
} from '@/lib/format'
import { PERKS, perkNudge, perkTier, quote, type PerkChoice, type PerkKind } from '@/lib/pricing'
import { REFERRAL_GIFTS, tierName, type ReferralChoice } from '@/lib/rewards'
import { rememberOrder, saveCustomer, savedCustomer } from '@/lib/local'
import { useCatalog } from '@/lib/use-catalog'
import type { Frequency, Fulfillment, PublicRewards } from '@/lib/types'
import { useCart } from '@/components/cart'
import { CartThumb } from '@/components/cart-drawer'
import { SiteHeader } from '@/components/site'
import { Button, ButtonLink, ChoiceCard, Field, Notice, Segmented, Spinner, cx, inputClass } from '@/components/ui'

function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

type Errors = Partial<Record<'fulfillment' | 'name' | 'phone' | 'cashTag' | 'address' | 'date' | 'referral' | 'perk' | 'form', string>>

export default function CheckoutPage() {
  const router = useRouter()
  const { products, settings, sale, status } = useCatalog()
  const { lines, ready, clear } = useCart()

  const open = settings?.is_open ?? true
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null)
  const method: Fulfillment = fulfillment ?? (open ? 'delivery' : 'pickup')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cashTag, setCashTag] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [timeWindow, setTimeWindow] = useState<string | null>(null)
  const [frequency, setFrequency] = useState<Frequency>('once')
  const [showReferral, setShowReferral] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralChoice, setReferralChoice] = useState<ReferralChoice | null>(null)
  const [perkPick, setPerkPick] = useState<PerkChoice | null>(null)
  const [preRollPick, setPreRollPick] = useState<string | null>(null)
  const [eighthPick, setEighthPick] = useState<string | null>(null)
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
    if (saved.address) setAddress(saved.address)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Recognize returning customers to show their tier pricing.
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
  const scheduledAhead = method === 'scheduled' && !!date && date > today

  // One deal per order: the spend perk competes with the House 10%, promos, banked credit and the
  // scheduled 5%. lib/pricing picks whichever is worth most to the customer (the server does the same).
  const tier = perkTier(quote(lines, products, { sale: null, tier: null, scheduledAhead: false }).merchandise)
  const wanted: PerkKind | null = tier === 'eighth' ? 'eighth' : tier === 'choice' ? (method === 'scheduled' && perkPick === 'credit' ? null : perkPick) : null
  const priced = useMemo(
    () => quote(lines, products, { sale, tier: knownAccount?.tier ?? null, scheduledAhead, credit: banked, perk: wanted }),
    [lines, products, sale, knownAccount, scheduledAhead, banked, wanted],
  )
  // Would any perk beat the other deals? If not, don't ask the customer to pick one.
  const perkCanWin = !!tier && quote(lines, products, {
    sale, tier: knownAccount?.tier ?? null, scheduledAhead, credit: banked, perk: tier === 'eighth' ? 'eighth' : 'prerolls',
  }).deal?.kind === 'perk'
  const perkChoice: PerkKind | null = priced.deal?.kind === 'perk' ? wanted : null
  const minimum = Number(settings?.delivery_minimum ?? 10)
  const short = method !== 'pickup' ? minimum - priced.merchandise : 0
  const cartGrams = (id: string) => lines.filter(l => l.productId === id && !l.rewardKey).reduce((s, l) => s + Number(l.weight ?? 0) * l.qty, 0)
  const eighthOptions = products.filter(p => p.category === 'Flower' && p.in_stock && Number(p.stock_grams) - cartGrams(p.id) >= 3.5)
  const preRollOptions = products.filter(p => p.category === 'Pre-Rolls' && p.in_stock)
  const perkProduct = products.find(p => p.id === (perkChoice === 'eighth' ? eighthPick : perkChoice === 'prerolls' ? preRollPick : null))

  function validate(): Errors {
    const e: Errors = {}
    if (method === 'delivery' && !open) e.fulfillment = 'Delivery is closed right now. Choose pickup or schedule it for later.'
    if (name.trim().length < 2) e.name = 'Enter your name.'
    if (!cleanPhone) e.phone = 'Enter a 10-digit US phone number.'
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(cashTag.replace(/^\$/, '').trim())) e.cashTag = 'Enter your Cash App $Cashtag, like $JaneDoe.'
    if (method !== 'pickup' && !address.trim()) e.address = 'Enter your apartment number.'
    if (method === 'scheduled' && !date) e.date = 'Choose a delivery date.'
    if (showReferral && referralCode.trim() && !referralChoice) e.referral = 'Choose your free pre-roll, or save it for later.'
    if (perkCanWin && tier === 'choice' && !wanted) e.perk = `Choose ${PERKS.freePreRolls} free pre-rolls or $${PERKS.credit} off your next order.`
    if (perkChoice === 'prerolls' && !perkProduct) e.perk = 'Pick which free pre-rolls you want.'
    if (perkChoice === 'eighth' && !perkProduct) e.perk = 'Pick the strain for your free 1/8.'
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillment: method,
          name: name.trim(),
          phone: cleanPhone,
          cashTag: cashTag.replace(/^\$/, '').trim(),
          address: method === 'pickup' ? '' : address.trim(),
          notes: notes.trim(),
          scheduledDate: method === 'scheduled' ? date : null,
          timeWindow: method === 'scheduled' ? timeWindow : null,
          frequency: method === 'scheduled' ? frequency : 'once',
          referralCode: showReferral ? referralCode.trim() : '',
          referralChoice: showReferral ? referralChoice : null,
          perk: perkChoice ? { choice: perkChoice, productId: perkProduct?.id ?? null } : null,
          lines,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(data.error || 'We couldn’t place your order. Please try again.')
        requestAnimationFrame(() => errorRef.current?.focus())
        return
      }
      saveCustomer({ name: name.trim(), phone: cleanPhone!, cashTag: cashTag.replace(/^\$/, '').trim(), address: method === 'pickup' ? address : address.trim() })
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
            Pay <span className="tabular font-semibold text-ink">{money(scheduled.total, { cents: true })}</span> to ${CASHTAG} when we confirm.
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
        <p className="mt-2 text-muted">Place your order, then pay on Cash App. We start as soon as your payment lands.</p>

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
                  detail="Pick a day. 5% off when you book a day or more ahead, and it can repeat."
                />
              </div>

              {method === 'scheduled' && (
                <div className="mt-2 flex flex-col gap-6">
                  <Field label="Delivery date" error={errors.date} hint={date && date > today ? 'Booked ahead: 5% off applied.' : 'Book for tomorrow or later to save 5%.'}>
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
                    {frequency !== 'once' && <p className="text-sm text-muted">Three repeat deliveries earns you an invitation to Member.</p>}
                  </div>
                </div>
              )}
            </section>

            {/* Perk */}
            {tier && perkCanWin && (
              <section aria-labelledby="perk-title" className="flex flex-col gap-4">
                <h2 id="perk-title" className="display flex items-center gap-2 text-2xl font-semibold">
                  <Gift size={22} strokeWidth={1.75} className="text-gold-ink" />
                  {tier === 'eighth' ? 'You unlocked a free 1/8' : 'You unlocked a perk'}
                </h2>
                {errors.perk && <p className="text-sm text-danger" data-error tabIndex={-1}>{errors.perk}</p>}

                {tier === 'choice' && (
                  <div className="flex flex-col gap-3">
                    <ChoiceCard
                      name="perk"
                      checked={perkPick === 'prerolls'}
                      onChange={() => setPerkPick('prerolls')}
                      title={`${PERKS.freePreRolls} free pre-rolls`}
                      detail="Added to this order."
                    />
                    <ChoiceCard
                      name="perk"
                      checked={perkPick === 'credit'}
                      onChange={() => setPerkPick('credit')}
                      disabled={method === 'scheduled'}
                      title={`$${PERKS.credit} off your next order`}
                      detail={method === 'scheduled' ? 'Not available on scheduled orders.' : 'Saved to your phone number once this order is delivered.'}
                    />
                    {wanted && priced.deal && priced.deal.kind !== 'perk' && (
                      <p className="text-sm text-muted">{priced.deal.label} is worth more on this order, so we’re using that instead.</p>
                    )}
                    {perkPick === 'prerolls' && preRollOptions.length > 0 && (
                      <Segmented
                        label="Which pre-rolls"
                        value={preRollPick}
                        onChange={setPreRollPick}
                        size="sm"
                        options={preRollOptions.map(p => ({ value: p.id, label: p.name }))}
                      />
                    )}
                  </div>
                )}

                {tier === 'eighth' && (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-muted">Pick the strain. It’s on us.</p>
                    {eighthOptions.length === 0 && <Notice tone="warn">No strain has a full 1/8 left after your cart. We’ll sort it out with you.</Notice>}
                    {eighthOptions.map(p => (
                      <ChoiceCard key={p.id} name="eighth" checked={eighthPick === p.id} onChange={() => setEighthPick(p.id)} title={p.name} detail={p.strain_type} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Who */}
            <section aria-labelledby="who-title" className="flex flex-col gap-5">
              <h2 id="who-title" className="display text-2xl font-semibold">Your details</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" error={errors.name}>
                  {p => <input {...p} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} />}
                </Field>
                <Field
                  label="Phone"
                  error={errors.phone}
                  hint={knownAccount ? `Welcome back, ${knownAccount.first_name}. ${tierName(knownAccount.tier)} · ${knownAccount.points} points.` : 'We text you when it’s on the way.'}
                >
                  {p => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />}
                </Field>
              </div>
              <Field label="Cash App $Cashtag" error={errors.cashTag} hint="So we can match your payment to your order.">
                {p => (
                  <div className="relative sm:max-w-xs">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-muted">$</span>
                    <input {...p} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={cashTag} onChange={e => setCashTag(e.target.value.replace(/^\$/, ''))} className={cx(inputClass, 'pl-8')} />
                  </div>
                )}
              </Field>
              {method !== 'pickup' && (
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
                {perkProduct && (
                  <li className="flex items-center gap-3">
                    <CartThumb image={perkProduct.image_urls?.[0] ?? null} reward />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{perkProduct.name}</p>
                      <p className="text-sm text-muted">{perkChoice === 'eighth' ? '1/8 oz · spend perk' : `× ${PERKS.freePreRolls} · spend perk`}</p>
                    </div>
                    <span className="tabular font-semibold">Free</span>
                  </li>
                )}
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

              {priced.deal && (priced.passedOver.length > 0 || (tier && !perkCanWin)) && (
                <p className="text-sm text-muted">One deal per order. {priced.deal.label} is your best one, so it’s the one applied.</p>
              )}
              {perkNudge(priced.merchandise) && <p className="text-sm text-gold-ink">{perkNudge(priced.merchandise)}</p>}

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
                  : `Next you’ll pay ${totalLabel} to $${CASHTAG} on Cash App.`}
              </p>
            </div>
          </aside>
        </form>
      </main>
    </>
  )
}
