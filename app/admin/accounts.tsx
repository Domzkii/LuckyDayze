'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, KeyRound, Link2, Plus, Tag, Trash2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { authHeaders } from '@/lib/use-account'
import { formatApt, formatPhone, formatTime, money, WEIGHTS, weightLabel } from '@/lib/format'
import type { Invite, PriceList, Profile, SpecialPrices } from '@/lib/types'
import { Badge, Button, ConfirmDialog, Dialog, Field, Notice, Spinner, cx, inputClass } from '@/components/ui'
import { EmptyState, errorText } from './shared'

const selectClass = cx(inputClass, 'appearance-none pr-10')

function inviteLink(code: string) {
  return `${window.location.origin}/account?invite=${code}`
}

function newInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => alphabet[b % alphabet.length]).join('')
}

function priceSummary(prices: SpecialPrices) {
  const set = WEIGHTS.filter(w => Number(prices[w]) > 0)
  return set.length ? set.map(w => `${weightLabel(w)} ${money(Number(prices[w]))}`).join(' · ') : 'No prices set yet'
}

export function AccountsTab() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [lists, setLists] = useState<PriceList[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [regular, setRegular] = useState<SpecialPrices>({})
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    const db = supabase()
    const [p, l, i, flower] = await Promise.all([
      db.from('profiles').select('*').order('created_at', { ascending: false }),
      db.from('price_lists').select('*').order('created_at'),
      db.from('invites').select('*').is('used_by', null).order('created_at', { ascending: false }),
      db.from('products').select('weight_prices').eq('category', 'Flower').eq('archived', false).limit(1).maybeSingle(),
    ])
    const failed = p.error || l.error || i.error
    if (failed) return setError(errorText(failed))
    setError(null)
    setProfiles((p.data ?? []) as Profile[])
    setLists((l.data ?? []) as PriceList[])
    setInvites((i.data ?? []) as Invite[])
    setRegular((flower.data?.weight_prices ?? {}) as SpecialPrices)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load()
  }, [load])

  if (error) {
    return (
      <Notice tone="danger" title="Couldn’t load accounts">
        {error.includes('does not exist') ? 'The accounts tables aren’t set up yet. Run supabase/migrations/0006_accounts.sql in Supabase.' : error}
      </Notice>
    )
  }
  if (!profiles) return <Spinner label="Loading accounts" />

  const current = profiles.find(p => p.user_id === selected)
  if (current) {
    return <AccountDetail profile={current} lists={lists} onBack={() => setSelected(null)} onChanged={load} />
  }

  return (
    <div className="flex flex-col gap-10">
      <PriceLists lists={lists} profiles={profiles} regular={regular} onChanged={load} />
      <Invites invites={invites} lists={lists} onChanged={load} />

      <section aria-labelledby="accounts-title" className="flex flex-col gap-3">
        <h2 id="accounts-title" className="display text-2xl font-semibold">Accounts</h2>
        {profiles.length === 0 ? (
          <EmptyState icon={<Users size={28} strokeWidth={1.5} />} title="No accounts yet">
            Building residents sign up at /account. Friends sign up with an invite link.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {profiles.map(p => {
              const list = lists.find(l => l.id === p.price_list_id)
              return (
                <li key={p.user_id}>
                  <button type="button" onClick={() => setSelected(p.user_id)} className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-sunken/60">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-semibold">{p.name}</span>
                      <span className="flex shrink-0 gap-1.5">
                        {list && <Badge tone="gold">{list.name} prices</Badge>}
                        <Badge>{p.kind === 'friend' ? 'Friend' : 'Building'}</Badge>
                      </span>
                    </div>
                    <p className="tabular truncate text-sm text-muted">
                      {formatPhone(p.phone)} · {p.kind === 'friend' ? p.street_address : formatApt(p.apt)}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ─── Special prices ──────────────────────────────────────────────────────────

function PriceLists({ lists, profiles, regular, onChanged }: {
  lists: PriceList[]; profiles: Profile[]; regular: SpecialPrices; onChanged: () => void
}) {
  const [editing, setEditing] = useState<PriceList | 'new' | null>(null)

  return (
    <section aria-labelledby="prices-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="prices-title" className="display text-2xl font-semibold">Special prices</h2>
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}><Plus size={16} strokeWidth={2} /> New price list</Button>
      </div>
      <p className="text-sm text-muted">
        Make a price list once, then give it to as many accounts as you like. Sizes you leave blank stay at the regular price.
        It counts as the order’s one deal, so it doesn’t stack with the spend perks or a promo.
      </p>
      {lists.length > 0 && (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {lists.map(l => {
            const users = profiles.filter(p => p.price_list_id === l.id)
            return (
              <li key={l.id}>
                <button type="button" onClick={() => setEditing(l)} className="flex w-full flex-col gap-1 px-4 py-3.5 text-left transition-colors hover:bg-sunken/60">
                  <span className="flex items-center gap-2 font-semibold"><Tag size={16} strokeWidth={1.75} className="text-gold-ink" /> {l.name}</span>
                  <span className="tabular text-sm">{priceSummary(l.prices)}</span>
                  <span className="text-sm text-muted">
                    {users.length ? `Used by ${users.map(u => u.name).join(', ')}` : 'Not given to anyone yet'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {editing && (
        <PriceListEditor
          list={editing === 'new' ? null : editing}
          regular={regular}
          inUse={editing !== 'new' && profiles.some(p => p.price_list_id === editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged() }}
        />
      )}
    </section>
  )
}

function PriceListEditor({ list, regular, inUse, onClose, onSaved }: {
  list: PriceList | null; regular: SpecialPrices; inUse: boolean; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(list?.name ?? '')
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(WEIGHTS.map(w => [w, list?.prices[w] ? String(list.prices[w]) : ''])),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    if (!name.trim()) return setError('Give it a name, like the customer’s name.')
    const clean: SpecialPrices = {}
    for (const w of WEIGHTS) {
      const raw = prices[w].trim()
      if (!raw) continue
      const n = Number(raw)
      if (!(n > 0)) return setError(`${weightLabel(w)}: enter a dollar amount, or leave it blank.`)
      clean[w] = Math.round(n * 100) / 100
    }
    setBusy(true)
    setError(null)
    const db = supabase().from('price_lists')
    const { error } = list
      ? await db.update({ name: name.trim(), prices: clean }).eq('id', list.id)
      : await db.insert({ name: name.trim(), prices: clean })
    setBusy(false)
    if (error) return setError(errorText(error))
    onSaved()
  }

  async function remove() {
    if (!list) return
    setBusy(true)
    const { error } = await supabase().from('price_lists').delete().eq('id', list.id)
    setBusy(false)
    if (error) { setConfirmDelete(false); return setError(errorText(error)) }
    onSaved()
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={list ? `Edit ${list.name}` : 'New price list'}
        footer={
          <div className="flex gap-3">
            {list && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete price list">
                <Trash2 size={16} strokeWidth={1.75} />
              </Button>
            )}
            <Button variant="outline" className="ml-auto" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={busy}><Check size={16} strokeWidth={2} /> Save</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name" hint="Only staff see this. Customers just see “Your prices.”">
            {p => <input {...p} value={name} onChange={e => setName(e.target.value)} placeholder="Lamar" className={inputClass} />}
          </Field>
          {WEIGHTS.map(w => (
            <Field key={w} label={weightLabel(w)} optional hint={regular[w] ? `Regular price ${money(Number(regular[w]))}` : undefined}>
              {p => (
                <div className="relative max-w-40">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-muted">$</span>
                  <input {...p} inputMode="decimal" value={prices[w]} onChange={e => setPrices(prev => ({ ...prev, [w]: e.target.value }))}
                    className={cx(inputClass, 'tabular pl-8')} />
                </div>
              )}
            </Field>
          ))}
          {inUse && <p className="text-sm text-muted">Changes apply to everyone on this list from their next order.</p>}
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={busy}
        tone="danger"
        title={`Delete ${list?.name}?`}
        body={inUse ? 'Anyone on this list goes back to regular prices. Past orders keep the prices they got.' : 'Nobody is on this list yet.'}
        confirmLabel="Delete"
      />
    </>
  )
}

// ─── Invites ─────────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {}
      }}
    >
      {copied ? <><Check size={16} strokeWidth={2} /> Copied</> : <><Copy size={16} strokeWidth={1.75} /> {label}</>}
    </Button>
  )
}

function Invites({ invites, lists, onChanged }: { invites: Invite[]; lists: PriceList[]; onChanged: () => void }) {
  const [note, setNote] = useState('')
  const [listId, setListId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase().from('invites').insert({ code: newInviteCode(), note: note.trim() || null, price_list_id: listId || null })
    setBusy(false)
    if (error) return setError(errorText(error))
    setNote('')
    setListId('')
    onChanged()
  }

  async function remove(code: string) {
    const { error } = await supabase().from('invites').delete().eq('code', code)
    if (error) return setError(errorText(error))
    onChanged()
  }

  return (
    <section aria-labelledby="invites-title" className="flex flex-col gap-3">
      <h2 id="invites-title" className="display text-2xl font-semibold">Invite a friend</h2>
      <p className="text-sm text-muted">
        For people outside the building. Text them the link; they make an account with their street address.
        Each link works once. Building residents don’t need one.
      </p>
      <form onSubmit={create} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end">
        <Field label="Who it’s for" optional className="flex-1">
          {p => <input {...p} value={note} onChange={e => setNote(e.target.value)} placeholder="Lamar" className={inputClass} />}
        </Field>
        <Field label="Special prices" optional className="flex-1">
          {p => (
            <select {...p} value={listId} onChange={e => setListId(e.target.value)} className={selectClass}>
              <option value="">Regular prices</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </Field>
        <Button type="submit" loading={busy}><Link2 size={16} strokeWidth={1.75} /> Make link</Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      {invites.length > 0 && (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {invites.map(i => {
            const list = lists.find(l => l.id === i.price_list_id)
            return (
              <li key={i.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.note || 'Invite'}{list && <span className="font-normal text-muted"> · {list.name} prices</span>}</p>
                  <p className="text-sm text-muted">Not used yet · made {formatTime(i.created_at)}</p>
                </div>
                <CopyButton text={inviteLink(i.code)} />
                <Button size="sm" variant="ghost" aria-label="Delete invite" onClick={() => remove(i.code)}><Trash2 size={16} strokeWidth={1.75} /></Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── One account ─────────────────────────────────────────────────────────────

function AccountDetail({ profile, lists, onBack, onChanged }: {
  profile: Profile; lists: PriceList[]; onBack: () => void; onChanged: () => void
}) {
  const [listId, setListId] = useState(profile.price_list_id ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  async function changeList(next: string) {
    setListId(next)
    setSaved(false)
    setError(null)
    const { error } = await supabase().from('profiles').update({ price_list_id: next || null }).eq('user_id', profile.user_id)
    if (error) return setError(errorText(error))
    setSaved(true)
    onChanged()
  }

  const facts: [string, React.ReactNode][] = [
    ['Phone', <a key="p" href={`tel:${profile.phone}`} className="font-semibold text-gold-ink hover:underline">{formatPhone(profile.phone)}</a>],
    ['Email', profile.email],
    ['Type', profile.kind === 'friend' ? 'Friend (outside the building)' : 'Building resident'],
    [profile.kind === 'friend' ? 'Address' : 'Apartment', profile.kind === 'friend' ? profile.street_address : formatApt(profile.apt)],
    ['Joined', formatTime(profile.created_at)],
  ]

  return (
    <section aria-label={profile.name} className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden /> All accounts
      </Button>
      <h2 className="display text-3xl font-semibold">{profile.name}</h2>

      <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      <Field label="Special prices" hint={saved ? 'Saved. Applies from their next order.' : 'Takes effect on their next order while they’re signed in.'} error={error}>
        {p => (
          <select {...p} value={listId} onChange={e => changeList(e.target.value)} className={cx(selectClass, 'sm:max-w-xs')}>
            <option value="">Regular prices</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}: {priceSummary(l.prices)}</option>)}
          </select>
        )}
      </Field>

      <div>
        <Button variant="outline" onClick={() => setResetOpen(true)}><KeyRound size={16} strokeWidth={1.75} /> Set a new password</Button>
        <p className="mt-2 text-sm text-muted">For when they forget theirs. Text them the new one.</p>
      </div>

      {resetOpen && <ResetPassword profile={profile} onClose={() => setResetOpen(false)} />}
    </section>
  )
}

function ResetPassword({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [password, setPassword] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ userId: profile.user_id, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'That didn’t work. Try again.')
      setDone(true)
    } catch {
      setError('Couldn’t reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`New password for ${profile.name.split(/\s+/)[0]}`}
      footer={done ? (
        <Button className="w-full" onClick={onClose}>Done</Button>
      ) : (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} loading={busy}>Set password</Button>
        </div>
      )}
    >
      {done ? (
        <div className="flex flex-col gap-3">
          <Notice tone="ok" title="Password changed">Text it to them. They can sign in with {profile.email} right away.</Notice>
          <p className="tabular text-2xl font-semibold tracking-wider">{password}</p>
          <CopyButton text={password} label="Copy password" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="New password" hint="We made one up. Change it if you like (8+ characters)." error={error}>
            {p => <input {...p} value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" className={cx(inputClass, 'tabular')} />}
          </Field>
        </div>
      )}
    </Dialog>
  )
}
