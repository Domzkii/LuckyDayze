'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Crown, Gift, Share2 } from 'lucide-react'
import { CASHTAG, formatDay, normalizePhone } from '@/lib/format'
import {
  HOUSE_MIN_ORDERS, HOUSE_MIN_POINTS, HOUSE_MONTHLY_FEE, MEMBER_MIN_ORDERS, REFERRAL_BONUS_POINTS,
  REFERRAL_REWARD_KEY, REWARDS, TIERS, tierName,
} from '@/lib/rewards'
import { savedCustomer } from '@/lib/local'
import type { PublicRewards, Tier } from '@/lib/types'
import { useCart } from '@/components/cart'
import { SiteFooter, SiteHeader } from '@/components/site'
import { Badge, Button, Dialog, Field, Notice, Segmented, cx, inputClass } from '@/components/ui'

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.')
  return data as T
}

export default function RewardsPage() {
  const [phone, setPhone] = useState('')
  const [account, setAccount] = useState<PublicRewards | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill from device storage
    setPhone(savedCustomer().phone ?? '')
  }, [])

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    const clean = normalizePhone(phone)
    if (!clean) return setError('Enter a 10-digit US phone number.')
    setBusy(true)
    setError(null)
    try {
      setAccount(await post<PublicRewards>('/api/rewards', { phone: clean }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SiteHeader back={{ href: '/', label: 'Menu' }} />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {account ? (
          <Account account={account} phone={normalizePhone(phone)!} onUpdate={setAccount} onReset={() => setAccount(null)} />
        ) : (
          <>
            <h1 className="display text-4xl font-semibold sm:text-6xl">Lucky Rewards</h1>
            <p className="mt-4 max-w-lg text-lg text-muted">Every dollar earns a point. Points turn into free pre-rolls and eighths, and regulars move up to The House.</p>
            <form onSubmit={lookup} className="mt-10 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-start">
              <Field label="Your phone number" error={error} className="flex-1">
                {p => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />}
              </Field>
              <Button type="submit" size="lg" loading={busy} className="sm:mt-7">Check points</Button>
            </form>
            <TierLadder />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}

function TierLadder({ current }: { current?: Tier }) {
  return (
    <section aria-labelledby="tiers-title" className="mt-16">
      <h2 id="tiers-title" className="display text-3xl font-semibold">How membership works</h2>
      <ol className="mt-6 flex flex-col gap-3">
        {TIERS.map(t => {
          const house = t.key === 'house'
          return (
            <li
              key={t.key}
              className={cx(
                'grid gap-4 rounded-3xl p-6 sm:grid-cols-[180px_1fr] sm:gap-8',
                house ? 'bg-night text-on-night' : 'border border-line bg-surface',
              )}
            >
              <div className="flex flex-col gap-1">
                <p className={cx('display flex items-center gap-2 text-2xl font-semibold', house && 'text-gold')}>
                  {house && <Crown size={20} strokeWidth={1.75} />}{t.name}
                </p>
                <p className={cx('text-sm font-semibold', house ? 'text-on-night-muted' : 'text-muted')}>{t.price}</p>
                {current === t.key && <Badge tone={house ? 'gold' : 'ok'} className="mt-2 self-start">You’re here</Badge>}
              </div>
              <div className="flex flex-col gap-3">
                <p className={house ? 'text-on-night-muted' : 'text-muted'}>{t.requirement}</p>
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {t.perks.map(p => (
                    <li key={p} className="flex gap-2 text-[15px]">
                      <Check size={16} strokeWidth={2} className={cx('mt-1 shrink-0', house ? 'text-gold' : 'text-ok')} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Account({ account, phone, onUpdate, onReset }: {
  account: PublicRewards; phone: string; onUpdate: (a: PublicRewards) => void; onReset: () => void
}) {
  const { add, lines } = useCart()
  const [added, setAdded] = useState<string | null>(null)
  const [applying, setApplying] = useState<'member' | 'house' | null>(null)
  const { tier, points, purchase_count: orders } = account

  const memberEligible = tier === 'guest' && orders >= MEMBER_MIN_ORDERS && !account.membership_requested
  const houseEligible = tier === 'member' && orders >= HOUSE_MIN_ORDERS && points >= HOUSE_MIN_POINTS && !account.membership_requested
  const rewardInCart = lines.some(l => l.rewardKey && l.rewardKey !== REFERRAL_REWARD_KEY)

  function addReward(key: string, name: string, category: 'Flower' | 'Pre-Rolls') {
    add({ productId: null, name, category, weight: null, qty: 1, image: null, rewardKey: key })
    setAdded(name)
  }

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-4xl font-semibold sm:text-5xl">Hey, {account.first_name}.</h1>
          <Badge tone={tier === 'house' ? 'night' : tier === 'member' ? 'ok' : 'neutral'}>{tierName(tier)}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="tabular display text-7xl font-semibold leading-none text-gold-ink">{points}</p>
            <p className="mt-2 text-muted">points</p>
          </div>
          <div>
            <p className="tabular display text-4xl font-semibold leading-none">{orders}</p>
            <p className="mt-2 text-muted">order{orders === 1 ? '' : 's'}</p>
          </div>
        </div>
      </header>

      {added && (
        <Notice tone="ok" icon={<Check size={18} strokeWidth={2} />} title={`${added} is in your cart.`}>
          We’ll check it against your points when you place the order.{' '}
          <Link href="/checkout" className="font-semibold underline">Go to checkout</Link>
        </Notice>
      )}

      {account.next_order_credit > 0 && (
        <Notice tone="ok" icon={<Gift size={18} strokeWidth={1.75} />} title={`$${account.next_order_credit} off your next order is waiting.`}>
          It comes off at checkout when you order with this number, unless another deal is worth more on that order.
        </Notice>
      )}

      {account.pending_referral_reward && (
        <section className="flex flex-col gap-4 rounded-3xl border border-gold/60 bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Gift size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-gold-ink" />
            <div>
              <p className="font-semibold">Your referral gift is waiting</p>
              <p className="text-muted">{account.pending_referral_reward}, free with your next order.</p>
            </div>
          </div>
          <Button
            variant="gold"
            disabled={lines.some(l => l.rewardKey === REFERRAL_REWARD_KEY)}
            onClick={() => addReward(REFERRAL_REWARD_KEY, 'Referral pre-roll', 'Pre-Rolls')}
          >
            {lines.some(l => l.rewardKey === REFERRAL_REWARD_KEY) ? 'In your cart' : 'Add to cart'}
          </Button>
        </section>
      )}

      <section aria-labelledby="spend-title" className="flex flex-col gap-4">
        <h2 id="spend-title" className="display text-2xl font-semibold">Spend your points</h2>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {REWARDS.map(r => {
            const unlocked = r.tiers.includes(tier)
            const enough = points >= r.points
            const inCart = lines.some(l => l.rewardKey === r.key)
            return (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted">
                    <span className="tabular">{r.points}</span> points
                    {r.pickupOnlyFor.includes(tier) && ' · pickup orders'}
                    {!unlocked && ' · unlocks at Member'}
                  </p>
                </div>
                {unlocked && enough ? (
                  <Button size="sm" variant={inCart ? 'outline' : 'primary'} disabled={inCart || (rewardInCart && !inCart)} onClick={() => addReward(r.key, r.name, r.category)}>
                    {inCart ? 'In your cart' : 'Add to cart'}
                  </Button>
                ) : (
                  <span className="tabular text-sm font-semibold text-muted">{unlocked ? `${r.points - points} to go` : 'Locked'}</span>
                )}
              </li>
            )
          })}
        </ul>
        {rewardInCart && <p className="text-sm text-muted">One points reward per order.</p>}
      </section>

      {tier === 'house' && <HousePerks account={account} />}

      {account.membership_requested && (
        <Notice tone="neutral" title={`Your ${tierName(account.membership_requested)} request is in.`}>We review every request personally and will text you soon.</Notice>
      )}
      {memberEligible && (
        <Upgrade
          title="You’ve earned Member."
          body={`${orders} orders in. Member is free: 2× points on $50+ orders and the free eighth reward.`}
          action="Apply for Member"
          onClick={() => setApplying('member')}
        />
      )}
      {houseEligible && (
        <Upgrade
          house
          title="You’re invited to The House."
          body={`${orders} orders and ${points} points. Join for $${HOUSE_MONTHLY_FEE} a month: 10% off $50+ orders, 2× points always, and free gifts.`}
          action="Join The House"
          onClick={() => setApplying('house')}
        />
      )}

      <Referral account={account} phone={phone} onUpdate={onUpdate} />

      <TierLadder current={tier} />

      <button type="button" onClick={onReset} className="self-start text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
        Look up a different number
      </button>

      <ApplyDialog tier={applying} phone={phone} onClose={() => setApplying(null)} onDone={a => { onUpdate(a); setApplying(null) }} />
    </div>
  )
}

function Upgrade({ title, body, action, onClick, house }: { title: string; body: string; action: string; onClick: () => void; house?: boolean }) {
  return (
    <section className={cx('flex flex-col gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8', house ? 'bg-night text-on-night' : 'border border-ok/40 bg-ok-tint')}>
      <div className="max-w-md">
        <p className={cx('display text-2xl font-semibold', house ? 'text-gold' : 'text-ok')}>{title}</p>
        <p className={cx('mt-1', house ? 'text-on-night-muted' : 'text-ink/80')}>{body}</p>
      </div>
      <Button variant={house ? 'gold' : 'primary'} size="lg" onClick={onClick} className="shrink-0">{action}</Button>
    </section>
  )
}

function HousePerks({ account }: { account: PublicRewards }) {
  const toNext = (n: number) => { const r = n - (account.purchase_count % n); return r === n ? n : r }
  const perks = [
    { label: 'Free pre-roll', detail: 'every 5th order', value: `${toNext(5)} to go` },
    { label: '10% off', detail: 'orders of $50+, when it’s your best deal', value: 'Automatic' },
    { label: '2× points', detail: 'on every order', value: 'Automatic' },
  ]
  return (
    <section aria-labelledby="house-title" className="flex flex-col gap-5 rounded-3xl bg-night p-6 text-on-night sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="house-title" className="display flex items-center gap-2 text-2xl font-semibold text-gold"><Crown size={20} strokeWidth={1.75} /> The House</h2>
        {account.house_paid_until && <p className="text-sm text-on-night-muted">Active until {formatDay(account.house_paid_until)}</p>}
      </div>
      <dl className="flex flex-col divide-y divide-white/10">
        {perks.map(p => (
          <div key={p.label} className="flex items-baseline justify-between gap-4 py-3">
            <dt>
              <span className="font-semibold">{p.label}</span> <span className="text-on-night-muted">{p.detail}</span>
            </dt>
            <dd className="tabular shrink-0 font-semibold text-gold">{p.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-on-night-muted">Renew with ${HOUSE_MONTHLY_FEE} to ${CASHTAG} on Cash App each month, with your name in the note.</p>
    </section>
  )
}

function Referral({ account, phone, onUpdate }: { account: PublicRewards; phone: string; onUpdate: (a: PublicRewards) => void }) {
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [choice, setChoice] = useState<'grabba' | 'plain' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canUseCode = !account.referred && account.purchase_count === 0

  async function share() {
    const text = `Use my LuckyDayze code ${account.referral_code} on your first order for ${REFERRAL_BONUS_POINTS} bonus points and a free pre-roll.`
    const url = `${window.location.origin}/rewards`
    try {
      if (navigator.share) {
        await navigator.share({ text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <section aria-labelledby="referral-title" className="grid gap-8 sm:grid-cols-2">
      <div className="flex flex-col gap-3">
        <h2 id="referral-title" className="display text-2xl font-semibold">Share your code</h2>
        <p className="text-muted">Friends get {REFERRAL_BONUS_POINTS} bonus points and a free pre-roll. You get 50 points when their first order lands.</p>
        <p className="display mt-2 text-4xl font-semibold tracking-[0.18em] text-gold-ink">{account.referral_code}</p>
        <Button variant="outline" className="self-start" onClick={share}>
          {copied ? <><Check size={16} strokeWidth={2} /> Copied</> : <><Share2 size={16} strokeWidth={1.75} /> Share invite</>}
        </Button>
        {account.referral_count > 0 && <p className="text-sm font-semibold text-ok">{account.referral_count} friend{account.referral_count === 1 ? '' : 's'} joined with your code.</p>}
      </div>

      {canUseCode && (
        <form
          className="flex flex-col gap-4"
          onSubmit={async e => {
            e.preventDefault()
            if (!code.trim()) return setError('Enter your friend’s code.')
            if (!choice) return setError('Choose your free pre-roll.')
            setBusy(true)
            setError(null)
            try {
              onUpdate(await post<PublicRewards>('/api/rewards/referral', { phone, code: code.trim(), choice }))
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <h2 className="display text-2xl font-semibold">Got a friend’s code?</h2>
          <Field label="Referral code" error={error}>
            {p => (
              <input {...p} autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                className={cx(inputClass, 'font-semibold uppercase tracking-[0.2em]')} />
            )}
          </Field>
          <Segmented
            label="Your free pre-roll"
            value={choice}
            onChange={setChoice}
            size="sm"
            options={[{ value: 'grabba', label: 'With Grabba' }, { value: 'plain', label: 'No Grabba' }]}
          />
          <Button type="submit" loading={busy} className="self-start">Apply code</Button>
        </form>
      )}
    </section>
  )
}

function ApplyDialog({ tier, phone, onClose, onDone }: {
  tier: 'member' | 'house' | null; phone: string; onClose: () => void; onDone: (a: PublicRewards) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const house = tier === 'house'

  return (
    <Dialog open={!!tier} onClose={onClose} title={house ? 'Join The House' : 'Apply for Member'}>
      <form
        className="flex flex-col gap-5"
        onSubmit={async e => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            onDone(await post<PublicRewards>('/api/rewards/membership', { phone, tier, name, email, birthday }))
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <p className="text-muted">We review every request personally and text you to confirm.</p>
        <Field label="Full name" optional>
          {p => <input {...p} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Email">
          {p => <input {...p} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Birthday" optional hint="We like to send something on your day.">
          {p => <input {...p} type="date" autoComplete="bday" value={birthday} onChange={e => setBirthday(e.target.value)} className={inputClass} />}
        </Field>
        {house && (
          <Notice tone="night" icon={<Crown size={16} strokeWidth={1.75} />} title={`$${HOUSE_MONTHLY_FEE} a month`}>
            <span className="text-on-night-muted">Send ${HOUSE_MONTHLY_FEE} to ${CASHTAG} on Cash App with your name in the note. We activate you once it lands.</span>
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" loading={busy}>{house ? 'Send request' : 'Apply'}</Button>
      </form>
    </Dialog>
  )
}
