'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Gift, Share2 } from 'lucide-react'
import { normalizePhone } from '@/lib/format'
import { REFERRAL_BONUS_POINTS, REFERRAL_REWARD_KEY, REWARDS } from '@/lib/rewards'
import { savedCustomer } from '@/lib/local'
import type { PublicRewards } from '@/lib/types'
import { useCart } from '@/components/cart'
import { SiteFooter, SiteHeader } from '@/components/site'
import { Button, Field, Notice, Segmented, cx, inputClass } from '@/components/ui'

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
            <p className="mt-4 max-w-lg text-lg text-muted">Every dollar earns a point. Points turn into free pre-rolls and eighths.</p>
            <form onSubmit={lookup} className="mt-10 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-start">
              <Field label="Your phone number" error={error} className="flex-1">
                {p => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />}
              </Field>
              <Button type="submit" size="lg" loading={busy} className="sm:mt-7">Check points</Button>
            </form>
            <HowItWorks />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}

function HowItWorks() {
  const steps = [
    '1 point for every $1 you spend',
    ...REWARDS.map(r => `${r.points} points: ${r.name.toLowerCase()}`),
    `Share your code: friends get a free pre-roll, you get ${REFERRAL_BONUS_POINTS} points`,
  ]
  return (
    <section aria-labelledby="how-title" className="mt-16">
      <h2 id="how-title" className="display text-3xl font-semibold">How points work</h2>
      <ul className="mt-6 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6">
        {steps.map(t => (
          <li key={t} className="flex gap-2 text-[15px]">
            <Check size={16} strokeWidth={2} className="mt-1 shrink-0 text-ok" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Account({ account, phone, onUpdate, onReset }: {
  account: PublicRewards; phone: string; onUpdate: (a: PublicRewards) => void; onReset: () => void
}) {
  const { add, lines } = useCart()
  const [added, setAdded] = useState<string | null>(null)
  const { points, purchase_count: orders } = account
  const rewardInCart = lines.some(l => l.rewardKey && l.rewardKey !== REFERRAL_REWARD_KEY)

  function addReward(key: string, name: string, category: 'Flower' | 'Pre-Rolls') {
    add({ productId: null, name, category, weight: null, qty: 1, image: null, rewardKey: key })
    setAdded(name)
  }

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <h1 className="display text-4xl font-semibold sm:text-5xl">Hey, {account.first_name}.</h1>
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
            const enough = points >= r.points
            const inCart = lines.some(l => l.rewardKey === r.key)
            return (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted">
                    <span className="tabular">{r.points}</span> points
                  </p>
                </div>
                {enough ? (
                  <Button size="sm" variant={inCart ? 'outline' : 'primary'} disabled={inCart || (rewardInCart && !inCart)} onClick={() => addReward(r.key, r.name, r.category)}>
                    {inCart ? 'In your cart' : 'Add to cart'}
                  </Button>
                ) : (
                  <span className="tabular text-sm font-semibold text-muted">{r.points - points} to go</span>
                )}
              </li>
            )
          })}
        </ul>
        {rewardInCart && <p className="text-sm text-muted">One points reward per order.</p>}
      </section>

      <Referral account={account} phone={phone} onUpdate={onUpdate} />

      <HowItWorks />

      <button type="button" onClick={onReset} className="self-start text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
        Look up a different number
      </button>
    </div>
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
