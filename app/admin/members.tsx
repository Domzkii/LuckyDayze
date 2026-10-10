'use client'

import { useState } from 'react'
import { Mail, Phone, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { Badge, Button, Notice, Spinner } from '@/components/ui'
import { formatPhone, formatTime, todayInStore } from '@/lib/format'
import { HOUSE_MONTHLY_FEE } from '@/lib/rewards'
import type { MembershipRequest } from '@/lib/types'
import { EmptyState, daysFromToday, errorText } from './shared'

export function MembersTab({
  requests, loading, error, onChanged,
}: { requests: MembershipRequest[]; loading: boolean; error: string | null; onChanged: () => void }) {
  const pending = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending').slice(0, 20)

  if (loading) return <Spinner label="Loading requests" />

  return (
    <section aria-label="Membership requests" className="flex flex-col gap-4">
      {error && <Notice tone="danger" title="Couldn’t load requests">{error}</Notice>}

      {pending.length === 0 ? (
        <EmptyState icon={<UserCheck size={28} strokeWidth={1.5} />} title="No requests waiting">
          Customers apply for Member after 3 orders and for The House after 6 orders and 500 points.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map(r => <RequestRow key={r.id} request={r} onChanged={onChanged} />)}
        </ul>
      )}

      {decided.length > 0 && (
        <>
          <h3 className="display mt-2 text-xl font-semibold">Recently decided</h3>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {decided.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.customer_name}</p>
                  <p className="text-muted">{r.requested_tier === 'house' ? 'The House' : 'Member'} · {formatTime(r.created_at)}</p>
                </div>
                <Badge tone={r.status === 'approved' ? 'ok' : 'danger'}>{r.status === 'approved' ? 'Approved' : 'Declined'}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function RequestRow({ request: r, onChanged }: { request: MembershipRequest; onChanged: () => void }) {
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const house = r.requested_tier === 'house'

  async function decide(approve: boolean) {
    setBusy(approve ? 'approve' : 'decline')
    setError(null)
    const client = supabase()
    const { error: reqError } = await client
      .from('membership_requests')
      .update({ status: approve ? 'approved' : 'declined' })
      .eq('id', r.id)
    if (reqError) { setBusy(null); return setError(errorText(reqError)) }

    const update = approve
      ? {
          membership_tier: r.requested_tier,
          membership_requested: null,
          ...(house ? { house_paid_until: daysFromToday(todayInStore(), 30) } : {}),
        }
      : { membership_requested: null }
    const { error: loyaltyError } = await client.from('loyalty').update(update).eq('customer_phone', r.customer_phone)
    setBusy(null)
    if (loyaltyError) return setError(errorText(loyaltyError))
    onChanged()
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display truncate text-lg font-semibold">{r.customer_name}</p>
          <p className="text-sm text-muted">Applied {formatTime(r.created_at)}</p>
        </div>
        <Badge tone={house ? 'night' : 'ok'}>{house ? 'The House' : 'Member'}</Badge>
      </div>

      <div className="flex flex-col gap-0.5 text-sm">
        <a href={`tel:${r.customer_phone}`} className="inline-flex min-h-10 items-center gap-2 text-gold-ink hover:underline">
          <Phone size={15} strokeWidth={1.75} aria-hidden /> {formatPhone(r.customer_phone)}
        </a>
        {r.customer_email && (
          <a href={`mailto:${r.customer_email}`} className="inline-flex min-h-10 items-center gap-2 text-gold-ink hover:underline">
            <Mail size={15} strokeWidth={1.75} aria-hidden /> {r.customer_email}
          </a>
        )}
        {r.customer_birthday && <p className="text-muted">Birthday: {r.customer_birthday}</p>}
      </div>

      {house && (
        <p className="text-sm text-muted">
          Check Cash App for their ${HOUSE_MONTHLY_FEE} House payment before approving. Approval covers 30 days.
        </p>
      )}

      {error && <Notice tone="danger" title="That didn’t save">{error}</Notice>}

      <div className="flex gap-2">
        <Button className="flex-1" loading={busy === 'approve'} disabled={!!busy} onClick={() => decide(true)}>Approve</Button>
        <Button variant="outline" className="flex-1" loading={busy === 'decline'} disabled={!!busy} onClick={() => decide(false)}>Decline</Button>
      </div>
    </li>
  )
}
