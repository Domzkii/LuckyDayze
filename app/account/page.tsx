'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Tag } from 'lucide-react'
import { formatApt, formatPhone, money, normalizePhone, weightLabel, WEIGHTS } from '@/lib/format'
import { supabase } from '@/lib/supabase/browser'
import { authHeaders, useAccount } from '@/lib/use-account'
import { saveCustomer, savedCustomer } from '@/lib/local'
import type { AccountInfo } from '@/lib/types'
import { SiteFooter, SiteHeader } from '@/components/site'
import { Button, Field, Notice, Segmented, Spinner, inputClass } from '@/components/ui'

export default function AccountPage() {
  const account = useAccount()

  // Checkout's "create an account" link brings people back to their cart once they're in.
  useEffect(() => {
    if (account.status !== 'signed-in') return
    if (new URLSearchParams(window.location.search).get('next') === 'checkout') window.location.replace('/checkout')
  }, [account.status])

  return (
    <>
      <SiteHeader back={{ href: '/', label: 'Menu' }} />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {account.status === 'loading' ? (
          <Spinner />
        ) : account.status === 'signed-in' ? (
          <SignedIn account={account.account} onUpdate={account.update} />
        ) : account.status === 'no-profile' ? (
          <div className="flex flex-col gap-4">
            <h1 className="display text-4xl font-semibold">Your account</h1>
            <Notice tone="warn" title="No customer account on this login">
              {account.session.user.email} is signed in, but it isn’t a customer account. Staff logins are for the admin.
            </Notice>
            <Button variant="outline" className="self-start" onClick={() => supabase().auth.signOut()}>Sign out</Button>
          </div>
        ) : (
          <SignedOut />
        )}
      </main>
      <SiteFooter />
    </>
  )
}

// ─── Signed out ──────────────────────────────────────────────────────────────

function SignedOut() {
  const [invite, setInvite] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  // An invite link (/account?invite=CODE) opens the friend sign-up; /account?signup=1 opens the plain one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('invite')
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL after mount */
    if (code || params.has('signup')) setMode('signup')
    if (!code) return
    setInvite(code.toUpperCase())
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/account/signup?invite=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(d => { if (!d.valid) setInviteError(d.reason) })
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="display text-4xl font-semibold sm:text-5xl">{invite && !inviteError ? 'You’re invited.' : 'Your account'}</h1>
        <p className="mt-3 text-lg text-muted">
          {invite && !inviteError
            ? 'Make an account and we’ll deliver to your address.'
            : 'Optional. You can always order as a guest. An account saves your details for next time.'}
        </p>
      </div>
      {inviteError && <Notice tone="warn" title="Invite link problem">{inviteError}</Notice>}
      <Segmented
        label="Sign in or create an account"
        value={mode}
        onChange={setMode}
        options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]}
      />
      {mode === 'signin' ? <SignInForm /> : <SignUpForm invite={inviteError ? null : invite} />}
    </div>
  )
}

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError('That email and password don’t match an account.')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <Field label="Email">
        {p => <input {...p} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Password" error={error} hint="Forgot it? Text us and we’ll set a new one.">
        {p => <input {...p} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />}
      </Field>
      <Button type="submit" size="lg" loading={busy} className="mt-1">Sign in</Button>
    </form>
  )
}

function SignUpForm({ invite }: { invite: string | null }) {
  const [where, setWhere] = useState<'building' | 'elsewhere'>('building')
  // Invite links are for people outside the building, so they skip the choice.
  const friend = !!invite || where === 'elsewhere'
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [place, setPlace] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = savedCustomer()
    /* eslint-disable react-hooks/set-state-in-effect -- one-time prefill from device storage */
    if (saved.name) setName(saved.name)
    if (saved.phone) setPhone(saved.phone)
    if (saved.address && !invite) setPlace(saved.address)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [invite])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cleanPhone = normalizePhone(phone)
    if (name.trim().length < 2) return setError('Enter your name.')
    if (!cleanPhone) return setError('Enter a 10-digit US phone number.')
    if (!place.trim()) return setError(friend ? 'Enter your street address.' : 'Enter your apartment number.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    setBusy(true)
    try {
      const res = await fetch('/api/account/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          email: email.trim(),
          password,
          invite,
          kind: friend ? 'friend' : 'building',
          apt: friend ? '' : place.trim(),
          street_address: friend ? place.trim() : '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'We couldn’t make your account. Try again.')
      // Drop the invite from the URL so a refresh doesn't show the sign-up again.
      window.history.replaceState(null, '', '/account')
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError('Your account is ready. Sign in with your email and password.')
    } catch {
      setError('We couldn’t reach the shop. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <Field label="Name">
        {p => <input {...p} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Phone" hint="Your points follow this number.">
        {p => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />}
      </Field>
      {!invite && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Where do you live?</p>
          <Segmented
            label="Where do you live?"
            value={where}
            onChange={w => { setWhere(w); setPlace('') }}
            size="sm"
            options={[{ value: 'building', label: 'In the building' }, { value: 'elsewhere', label: 'Somewhere else' }]}
          />
        </div>
      )}
      {friend ? (
        <Field label="Street address" hint="Where we deliver. Include the apartment or floor if there is one.">
          {p => <input {...p} autoComplete="street-address" maxLength={120} value={place} onChange={e => setPlace(e.target.value)} className={inputClass} />}
        </Field>
      ) : (
        <Field label="Apartment number" hint="Your door in the building, like 4B.">
          {p => <input {...p} autoComplete="address-line2" autoCapitalize="characters" maxLength={20} value={place} onChange={e => setPlace(e.target.value)} className={inputClass} />}
        </Field>
      )}
      <Field label="Email" hint="You sign in with this. We don’t send emails.">
        {p => <input {...p} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        {p => <input {...p} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />}
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" loading={busy} className="mt-1">Create account</Button>
    </form>
  )
}

// ─── Signed in ───────────────────────────────────────────────────────────────

function SignedIn({ account, onUpdate }: { account: AccountInfo; onUpdate: (a: AccountInfo) => void }) {
  const friend = account.kind === 'friend'
  const [editing, setEditing] = useState(false)
  const specials = WEIGHTS.filter(w => Number(account.prices?.[w]) > 0)

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="display text-4xl font-semibold sm:text-5xl">Hey, {account.name.split(/\s+/)[0]}.</h1>
        <p className="mt-3 text-muted">Signed in as {account.email}. Checkout fills in your details for you.</p>
      </header>

      {specials.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl border border-gold/60 bg-surface p-6">
          <p className="flex items-center gap-2 font-semibold"><Tag size={18} strokeWidth={1.75} className="text-gold-ink" /> Your prices</p>
          <ul className="flex flex-col gap-1">
            {specials.map(w => (
              <li key={w} className="flex justify-between text-[15px]">
                <span>{weightLabel(w)} of any strain</span>
                <span className="tabular font-semibold">{money(Number(account.prices![w]))}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">They come off at checkout while you’re signed in. One deal per order, so they don’t stack with other deals.</p>
        </section>
      )}

      {editing ? (
        <EditDetails account={account} onDone={a => { if (a) onUpdate(a); setEditing(false) }} />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="display text-2xl font-semibold">Your details</h2>
          <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {[
              ['Name', account.name],
              ['Phone', formatPhone(account.phone)],
              [friend ? 'Delivery address' : 'Apartment', friend ? account.street_address : formatApt(account.apt)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-3 text-[15px]">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing(true)}>Edit details</Button>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/rewards" className="inline-flex min-h-11 items-center rounded-full px-1 font-semibold text-gold-ink underline underline-offset-4 hover:text-ink">
          See your points
        </Link>
        <Button variant="ghost" className="ml-auto" onClick={() => supabase().auth.signOut()}>Sign out</Button>
      </div>
    </div>
  )
}

function EditDetails({ account, onDone }: { account: AccountInfo; onDone: (a: AccountInfo | null) => void }) {
  const friend = account.kind === 'friend'
  const [name, setName] = useState(account.name)
  const [phone, setPhone] = useState(formatPhone(account.phone))
  const [place, setPlace] = useState((friend ? account.street_address : account.apt) ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ name, phone, apt: place, street_address: place }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'That didn’t save. Try again.')
      const saved = savedCustomer()
      saveCustomer({ name: data.name, phone: data.phone, payment: saved.payment, cashTag: saved.cashTag ?? '', address: place.trim() })
      onDone(data)
    } catch {
      setError('We couldn’t reach the shop. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <h2 className="display text-2xl font-semibold">Your details</h2>
      <Field label="Name">
        {p => <input {...p} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Phone">
        {p => <input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />}
      </Field>
      <Field label={friend ? 'Street address' : 'Apartment number'}>
        {p => <input {...p} maxLength={friend ? 120 : 20} value={place} onChange={e => setPlace(e.target.value)} className={inputClass} />}
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex gap-3">
        <Button type="submit" loading={busy}><Check size={16} strokeWidth={2} /> Save</Button>
        <Button type="button" variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
      </div>
    </form>
  )
}
