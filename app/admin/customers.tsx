'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Phone, Search, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { Button, Notice, Spinner, cx, inputClass } from '@/components/ui'
import { formatPhone, formatTime, money } from '@/lib/format'
import type { Loyalty, Order } from '@/lib/types'
import { EmptyState, FulfillmentLabel, StatusBadge, errorText, itemSummary } from './shared'

export function CustomersTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Loyalty[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Loyalty | null>(null)

  async function search(e?: React.FormEvent) {
    e?.preventDefault()
    const q = query.trim()
    setSearching(true)
    setError(null)
    let request = supabase().from('loyalty').select('*').order('created_at', { ascending: false }).limit(50)
    if (q) {
      // PostgREST `or` filters are comma separated; strip characters that would break the expression.
      const safe = q.replace(/[,()*%\\]/g, ' ').trim()
      const digits = q.replace(/\D/g, '')
      const clauses = [`customer_name.ilike.*${safe}*`]
      if (digits.length >= 3) clauses.push(`customer_phone.ilike.*${digits}*`)
      request = request.or(clauses.join(','))
    }
    const { data, error } = await request
    setSearching(false)
    if (error) return setError(errorText(error))
    setResults((data ?? []) as Loyalty[])
  }

  if (selected) return <CustomerDetail customer={selected} onBack={() => setSelected(null)} />

  return (
    <section aria-label="Customers" className="flex flex-col gap-4">
      <form onSubmit={search} role="search" className="flex gap-2">
        <label htmlFor="customer-search" className="sr-only">Search customers by name or phone</label>
        <div className="relative flex-1">
          <Search size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="customer-search"
            type="search"
            placeholder="Name or phone"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={cx(inputClass, 'pl-10')}
          />
        </div>
        <Button type="submit" loading={searching}>Search</Button>
      </form>

      {error && <Notice tone="danger" title="Search failed">{error}</Notice>}

      {searching && !results ? (
        <Spinner label="Searching" />
      ) : results === null ? (
        <EmptyState icon={<Users size={28} strokeWidth={1.5} />} title="Find a customer">
          Search by name or phone, or search with an empty box to see the newest customers.
        </EmptyState>
      ) : results.length === 0 ? (
        <EmptyState icon={<Search size={28} strokeWidth={1.5} />} title="No customers match">
          Try part of the name or the last four digits of their phone.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {results.map(c => (
            <li key={c.id}>
              <button type="button" onClick={() => setSelected(c)} className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-sunken/60">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-semibold">{c.customer_name}</span>
                </div>
                <p className="tabular text-sm text-muted">
                  {formatPhone(c.customer_phone)} · {c.points} pts · {c.purchase_count} orders · {money(Number(c.total_spent), { cents: false })}
                  {c.referral_count > 0 && ` · ${c.referral_count} referrals`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CustomerDetail({ customer, onBack }: { customer: Loyalty; onBack: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    supabase()
      .from('orders')
      .select('*')
      .eq('customer_phone', customer.customer_phone)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!live) return
        if (error) setError(errorText(error))
        setOrders((data ?? []) as Order[])
      })
    return () => { live = false }
  }, [customer.customer_phone])

  const facts: [string, React.ReactNode][] = [
    ['Points', <span key="p" className="tabular">{customer.points}</span>],
    ['Orders', <span key="o" className="tabular">{customer.purchase_count}</span>],
    ['Spent', <span key="s" className="tabular">{money(Number(customer.total_spent), { cents: false })}</span>],
    ['Referral code', <span key="r" className="tabular font-semibold tracking-widest text-gold-ink">{customer.referral_code}</span>],
  ]
  if (customer.referred_by) facts.push(['Referred by', customer.referred_by])
  if (customer.referral_count > 0) facts.push(['Referrals', <span key="rc" className="tabular">{customer.referral_count}</span>])
  if (customer.pending_referral_reward) facts.push(['Gift to claim', customer.pending_referral_reward])
  if (customer.email) facts.push(['Email', <a key="e" href={`mailto:${customer.email}`} className="text-gold-ink hover:underline">{customer.email}</a>])
  if (customer.birthday) facts.push(['Birthday', customer.birthday])

  return (
    <section aria-label={customer.customer_name} className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden /> All customers
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display truncate text-3xl font-semibold">{customer.customer_name}</h2>
          <a href={`tel:${customer.customer_phone}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-gold-ink hover:underline">
            <Phone size={16} strokeWidth={1.75} aria-hidden /> {formatPhone(customer.customer_phone)}
          </a>
        </div>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-line rounded-2xl border border-line bg-surface sm:grid-cols-2 sm:divide-y-0">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm sm:border-b sm:border-line">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="display text-xl font-semibold">Order history</h3>
      {error && <Notice tone="danger" title="Couldn’t load orders">{error}</Notice>}
      {orders === null ? (
        <Spinner label="Loading orders" />
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted">No orders yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {orders.map(o => (
            <li key={o.id} className="flex flex-col gap-1.5 px-4 py-3.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{formatTime(o.created_at)}</span>
                <StatusBadge order={o} />
              </div>
              <p className="text-muted">{itemSummary(o.items)}</p>
              <div className="flex items-center justify-between gap-3">
                <FulfillmentLabel fulfillment={o.fulfillment} />
                <span className="tabular font-semibold">{money(Number(o.total), { cents: true })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
