'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { Check, Minus, Plus } from 'lucide-react'
import { money } from '@/lib/format'
import { savedCustomer } from '@/lib/local'
import { AgeGate } from '@/components/site'
import { ThemeToggle } from '@/components/theme'
import { Button, Field, IconButton, Notice, Spinner, Wordmark, inputClass } from '@/components/ui'

/** Hussein's dad's secret page: every strain as an 8th at his price. No account, no checkout steps. */

interface Strain { id: string; name: string; strain_type: string; thc: string | null; image: string | null; eighths: number }
interface Menu { price: number; strains: Strain[] }

export default function SecretPage() {
  return (
    <AgeGate>
      <SecretMenu />
    </AgeGate>
  )
}

function SecretMenu() {
  const { code } = useParams<{ code: string }>()
  const [menu, setMenu] = useState<Menu | null>(null)
  const [missing, setMissing] = useState(false)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<number | null>(null)

  useEffect(() => {
    const saved = savedCustomer()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prefilling from device storage after mount
    if (saved.name) setName(saved.name)
    if (saved.phone) setPhone(saved.phone)
    fetch(`/api/secret/${encodeURIComponent(code)}`)
      .then(async r => (r.ok ? setMenu(await r.json()) : setMissing(true)))
      .catch(() => setMissing(true))
  }, [code])

  const count = Object.values(qty).reduce((n, q) => n + q, 0)
  const total = count * (menu?.price ?? 0)
  const step = (s: Strain, by: number) => setQty(prev => ({ ...prev, [s.id]: Math.min(s.eighths, Math.max(0, (prev[s.id] ?? 0) + by)) }))

  async function send() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/secret/${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, notes, lines: Object.entries(qty).filter(([, q]) => q > 0).map(([productId, q]) => ({ productId, qty: q })) }),
    }).catch(() => null)
    setBusy(false)
    if (!res) return setError('Couldn’t reach us. Check your connection and try again.')
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return setError(body.error ?? 'Something went wrong. Please try again.')
    setPlaced(body.total)
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <Wordmark />
        <ThemeToggle />
      </div>

      {missing ? (
        <div className="mt-24 text-center">
          <h1 className="display text-3xl font-semibold">This page isn’t available.</h1>
        </div>
      ) : !menu ? (
        <div className="mt-24"><Spinner label="Loading the menu" /></div>
      ) : placed !== null ? (
        <div className="mt-20 flex flex-col items-center text-center animate-rise">
          <span className="flex size-14 items-center justify-center rounded-full bg-ok-tint text-ok"><Check size={28} strokeWidth={2} /></span>
          <h1 className="display mt-6 text-3xl font-semibold">Got it.</h1>
          <p className="mt-3 text-muted">
            Your order for <span className="tabular font-semibold text-ink">{money(placed)}</span> is in. You’ll hear back soon. Pay cash when you get it.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-10">
            <h1 className="display text-4xl font-semibold">8ths, {money(menu.price)}.</h1>
            <p className="mt-2 text-muted">Pick what you want. Pay cash when you get it.</p>
          </div>

          {menu.strains.length === 0 ? (
            <Notice className="mt-8">Everything’s sold out right now. Check back soon.</Notice>
          ) : (
            <ul className="mt-6 flex flex-col">
              {menu.strains.map(s => {
                const n = qty[s.id] ?? 0
                return (
                  <li key={s.id} className="flex items-center gap-4 border-b border-line py-4 last:border-b-0">
                    {s.image && (
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sunken">
                        <Image src={s.image} alt="" fill sizes="56px" className="object-cover" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold">{s.name}</p>
                      <p className="text-sm text-muted">{s.strain_type}{s.thc ? ` · ${s.thc} THC` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label={`One less ${s.name}`} onClick={() => step(s, -1)} disabled={n === 0}>
                        <Minus size={20} strokeWidth={1.75} />
                      </IconButton>
                      <span className="tabular w-7 text-center text-lg font-semibold" aria-live="polite">{n}</span>
                      <IconButton label={`One more ${s.name}`} onClick={() => step(s, 1)} disabled={n >= s.eighths}>
                        <Plus size={20} strokeWidth={1.75} />
                      </IconButton>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {count > 0 && (
            <div className="mt-8 flex flex-col gap-5">
              <div className="flex items-baseline justify-between border-y border-line py-4 text-lg font-semibold">
                <span className="tabular">{count} × 8th</span>
                <span className="tabular text-gold-ink">{money(total)}</span>
              </div>
              <Field label="Your name">
                {props => <input {...props} value={name} onChange={e => setName(e.target.value)} autoComplete="name" className={inputClass} />}
              </Field>
              <Field label="Phone number">
                {props => <input {...props} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" className={`${inputClass} tabular`} />}
              </Field>
              <Field label="Anything else?" optional>
                {props => <input {...props} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Where or when works for you" className={inputClass} />}
              </Field>
              {error && <Notice tone="danger">{error}</Notice>}
              <Button size="lg" onClick={send} loading={busy}>Send order · {money(total)}</Button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
