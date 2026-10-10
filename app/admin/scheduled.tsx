'use client'

import { useState } from 'react'
import { CalendarClock, ChevronDown, Clock, DoorOpen, Phone, Repeat } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { Badge, Button, ConfirmDialog, Notice, Spinner } from '@/components/ui'
import { formatApt, formatDay, formatPhone, money, todayInStore } from '@/lib/format'
import type { ScheduledOrder } from '@/lib/types'
import { EmptyState, errorText, itemSummary } from './shared'

const FREQUENCY_LABEL: Record<ScheduledOrder['frequency'], string> = {
  once: 'One time',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
}

export function ScheduledTab({
  scheduled, loading, error, onChanged, onQueued,
}: {
  scheduled: ScheduledOrder[]
  loading: boolean
  error: string | null
  onChanged: () => void
  onQueued: (orderId: string) => void
}) {
  const [showPast, setShowPast] = useState(false)
  const today = todayInStore()
  const pending = scheduled.filter(s => s.status === 'pending').sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))
  const past = scheduled.filter(s => s.status !== 'pending')

  if (loading) return <Spinner label="Loading scheduled orders" />

  return (
    <section aria-label="Scheduled orders" className="flex flex-col gap-4">
      {error && <Notice tone="danger" title="Couldn’t load scheduled orders">{error}</Notice>}

      {pending.length === 0 ? (
        <EmptyState icon={<CalendarClock size={28} strokeWidth={1.5} />} title="Nothing scheduled">
          When customers book a delivery for a later day, it waits here until you queue it.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map(s => (
            <ScheduledRow key={s.id} s={s} today={today} onChanged={onChanged} onQueued={onQueued} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showPast}
            onClick={() => setShowPast(v => !v)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
          >
            <ChevronDown size={16} strokeWidth={1.75} className={showPast ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden />
            Past ({past.length})
          </button>
          {showPast && (
            <ul className="mt-2 flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
              {past.map(s => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.customer_name}</p>
                    <p className="text-muted">{formatDay(s.delivery_date)} · {FREQUENCY_LABEL[s.frequency]}</p>
                  </div>
                  <Badge tone={s.status === 'completed' ? 'ok' : 'danger'}>{s.status === 'completed' ? 'Completed' : 'Cancelled'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function ScheduledRow({
  s, today, onChanged, onQueued,
}: { s: ScheduledOrder; today: string; onChanged: () => void; onQueued: (orderId: string) => void }) {
  const [busy, setBusy] = useState<'queue' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const isToday = s.delivery_date === today
  const isOverdue = s.delivery_date < today

  async function queue() {
    setBusy('queue')
    setError(null)
    const { data, error } = await supabase().rpc('queue_scheduled_order', { p_scheduled_id: s.id })
    setBusy(null)
    if (error) return setError(errorText(error))
    onChanged()
    if (typeof data === 'string') onQueued(data)
  }

  async function cancel() {
    setBusy('cancel')
    setError(null)
    const { error } = await supabase().from('scheduled_orders').update({ status: 'cancelled' }).eq('id', s.id)
    setBusy(null)
    setConfirmCancel(false)
    if (error) return setError(errorText(error))
    onChanged()
  }

  return (
    <li className={`flex flex-col gap-3 rounded-2xl border bg-surface p-4 ${isOverdue ? 'border-danger/60' : isToday ? 'border-gold' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display truncate text-lg font-semibold">{s.customer_name}</p>
          <a href={`tel:${s.customer_phone}`} className="inline-flex min-h-9 items-center gap-1.5 text-sm text-gold-ink hover:underline">
            <Phone size={14} strokeWidth={1.75} aria-hidden /> {formatPhone(s.customer_phone)}
          </a>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {isOverdue ? <Badge tone="danger">Overdue</Badge> : isToday ? <Badge tone="gold">Today</Badge> : null}
          {s.frequency !== 'once' && (
            <Badge tone="indica"><Repeat size={12} strokeWidth={2} aria-hidden /> {FREQUENCY_LABEL[s.frequency]}</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <p className="inline-flex items-center gap-2 font-semibold">
          <CalendarClock size={15} strokeWidth={1.75} aria-hidden /> {formatDay(s.delivery_date)}
          {s.delivery_time_window && (
            <span className="inline-flex items-center gap-1 font-normal text-muted">
              <Clock size={14} strokeWidth={1.75} aria-hidden /> {s.delivery_time_window}
            </span>
          )}
        </p>
        <p className="inline-flex items-start gap-2 text-muted">
          <DoorOpen size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden /> {formatApt(s.customer_address)}
        </p>
        <p className="text-muted">{itemSummary(s.items)}</p>
        {s.order_notes && <p className="text-muted">Note: {s.order_notes}</p>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {s.recurring_count > 0 && <span className="tabular">{s.recurring_count} delivered · </span>}
          {(s.discounts ?? []).length > 0 && 'discounts applied'}
        </span>
        <span className="tabular font-semibold">{money(Number(s.total), { cents: true })}</span>
      </div>

      {error && <Notice tone="danger" title="That didn’t save">{error}</Notice>}

      <div className="flex gap-2">
        <Button className="flex-1" loading={busy === 'queue'} onClick={queue}>Queue delivery</Button>
        <Button variant="danger" onClick={() => setConfirmCancel(true)}>Cancel</Button>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        title="Cancel this scheduled order?"
        body={s.frequency === 'once'
          ? `${s.customer_name}’s delivery on ${formatDay(s.delivery_date)} will be cancelled.`
          : `This stops all future ${FREQUENCY_LABEL[s.frequency].toLowerCase()} deliveries for ${s.customer_name}.`}
        confirmLabel="Cancel it"
        tone="danger"
        loading={busy === 'cancel'}
      />
    </li>
  )
}
