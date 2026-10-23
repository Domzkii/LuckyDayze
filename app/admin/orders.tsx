'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BellRing, Banknote, DoorOpen, ExternalLink, Gift, Inbox, MapPin, Phone, StickyNote } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { Badge, Button, ConfirmDialog, Dialog, Notice, Spinner, cx } from '@/components/ui'
import { STORE_TIME_ZONE, formatApt, formatPhone, formatTime, money, orderCode, paymentLabel, todayInStore } from '@/lib/format'
import { rewardByKey } from '@/lib/rewards'
import type { Loyalty, Order, OrderStatus, Sale } from '@/lib/types'
import { ACTIVE_STATUSES, EmptyState, FulfillmentLabel, StatusBadge, errorText, itemLine, itemSummary, statusLabel } from './shared'

type Filter = 'active' | OrderStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'All active' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'out_for_delivery', label: 'Out / Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const FLOW: OrderStatus[] = ['pending_payment', 'confirmed', 'preparing', 'out_for_delivery']
const REVENUE_STATUSES: OrderStatus[] = ['confirmed', 'preparing', 'out_for_delivery', 'delivered']

const storeDay = new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE })

export function OrdersTab({
  orders, loading, error, onChanged, focusId, onFocusHandled,
}: {
  orders: Order[]
  loading: boolean
  error: string | null
  onChanged: () => void
  focusId: string | null
  onFocusHandled: () => void
}) {
  const [filter, setFilter] = useState<Filter>('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (focusId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- opening an order requested by another tab
      setSelectedId(focusId)
      onFocusHandled()
    }
  }, [focusId, onFocusHandled])

  const counts = useMemo(() => {
    const c: Record<string, number> = { active: 0 }
    for (const o of orders) {
      c[o.status] = (c[o.status] ?? 0) + 1
      if (ACTIVE_STATUSES.includes(o.status)) c.active++
    }
    return c
  }, [orders])

  // Sales logged by hand in Finance (Hussein's dad) have no order, so they're read from sales directly.
  const [handSales, setHandSales] = useState<Pick<Sale, 'created_at' | 'revenue'>[]>([])
  useEffect(() => {
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
    supabase().from('sales').select('created_at, revenue').not('seller', 'is', null).gte('created_at', since)
      .then(({ data }) => setHandSales(data ?? []))
  }, [orders])

  const today = todayInStore()
  // A sale counts on the day it was delivered, or the day it was placed if it's still on its way.
  const todays = orders.filter(o => storeDay.format(new Date(o.delivered_at ?? o.created_at)) === today && REVENUE_STATUSES.includes(o.status))
  const todaysHand = handSales.filter(s => storeDay.format(new Date(s.created_at)) === today)
  const handRevenue = todaysHand.reduce((s, h) => s + Number(h.revenue || 0), 0)
  const todayRevenue = todays.reduce((s, o) => s + Number(o.total || 0), 0) + handRevenue
  const todayCount = todays.length + todaysHand.length

  const visible = filter === 'active' ? orders.filter(o => ACTIVE_STATUSES.includes(o.status)) : orders.filter(o => o.status === filter)
  const selected = orders.find(o => o.id === selectedId) ?? null

  return (
    <section aria-label="Orders" className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Today: <span className="tabular font-semibold text-ink">{money(todayRevenue, { cents: false })}</span> from{' '}
        <span className="tabular font-semibold text-ink">{todayCount}</span> paid sale{todayCount === 1 ? '' : 's'}
        {todaysHand.length > 0 && <> · <span className="tabular">{money(handRevenue, { cents: false })}</span> from Hussein’s dad</>}
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cx(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
              filter === f.value ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-ink hover:border-line-strong',
            )}
          >
            {f.label}
            <span className={cx('tabular text-xs', filter === f.value ? 'text-canvas/70' : 'text-muted')}>{counts[f.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <Notice tone="danger" title="Couldn’t load orders">{error}</Notice>}

      {loading ? (
        <Spinner label="Loading orders" />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Inbox size={28} strokeWidth={1.5} />} title={filter === 'active' ? 'No open orders' : 'Nothing here'}>
          {filter === 'active' ? 'New orders show up here the moment they’re placed.' : 'No orders with this status yet.'}
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map(order => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => setSelectedId(order.id)}
                className="flex w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-sunken/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="display truncate text-lg font-semibold">{order.customer_name}</p>
                    <p className="text-sm text-muted">{formatTime(order.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge order={order} />
                    {order.customer_arrived && order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <Badge tone="danger" className="animate-pulse">
                        <BellRing size={12} strokeWidth={2} aria-hidden /> Arrived
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <FulfillmentLabel fulfillment={order.fulfillment} className="font-semibold" />
                  <span className="min-w-0 truncate text-muted">
                    {order.fulfillment === 'pickup' ? 'Pickup from us' : formatApt(order.customer_address)}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <p className="line-clamp-2 text-sm text-muted">
                    {order.payment_method === 'zelle' ? <span className="font-semibold text-ok">Zelle {orderCode(order.id)} · </span>
                      : order.payment_method === 'applepay' ? <span className="font-semibold text-ok">Apple Pay {orderCode(order.id)} · </span>
                      : order.payment_method === 'cash' ? <span className="font-semibold text-ok">Cash · </span>
                      : order.cash_tag && <span className="font-semibold text-ok">${order.cash_tag} · </span>}
                    {itemSummary(order.items)}
                  </p>
                  <span className="tabular shrink-0 font-semibold">{money(Number(order.total), { cents: true })}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <OrderDetail order={selected} onClose={() => setSelectedId(null)} onChanged={onChanged} />
    </section>
  )
}

function nextStep(order: Order): { status: OrderStatus; label: string } | null {
  switch (order.status) {
    case 'pending_payment': return { status: 'confirmed', label: order.payment_method === 'cash' ? 'Approve cash order' : 'Payment received' }
    case 'confirmed': return { status: 'preparing', label: 'Start preparing' }
    case 'preparing': return { status: 'out_for_delivery', label: order.fulfillment === 'pickup' ? 'Ready for pickup' : 'Out for delivery' }
    case 'out_for_delivery': return { status: 'delivered', label: order.fulfillment === 'pickup' ? 'Mark picked up' : 'Mark delivered' }
    default: return null
  }
}

function OrderDetail({ order, onClose, onChanged }: { order: Order | null; onClose: () => void; onChanged: () => void }) {
  return (
    <Dialog open={!!order} onClose={onClose} title={order ? order.customer_name : 'Order'}>
      {order && <OrderDetailBody key={order.id} order={order} onChanged={onChanged} onClose={onClose} />}
    </Dialog>
  )
}

function OrderDetailBody({ order, onChanged, onClose }: { order: Order; onChanged: () => void; onClose: () => void }) {
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    let live = true
    supabase()
      .from('loyalty')
      .select('*')
      .eq('customer_phone', order.customer_phone)
      .maybeSingle()
      .then(({ data }) => { if (live) setLoyalty(data as Loyalty | null) })
    return () => { live = false }
  }, [order.customer_phone])

  const final = order.status === 'delivered' || order.status === 'cancelled'
  const step = nextStep(order)
  const flowIndex = FLOW.indexOf(order.status)
  const previous = flowIndex > 0 ? FLOW[flowIndex - 1] : null
  const reward = order.reward_key ? rewardByKey(order.reward_key) : null
  const hasAddress = order.fulfillment !== 'pickup' && !!order.customer_address

  async function setStatus(status: OrderStatus) {
    setBusy(status)
    setError(null)
    const { error } = await supabase().from('orders').update({ status }).eq('id', order.id)
    setBusy(null)
    if (error) return setError(errorText(error))
    onChanged()
  }

  // Deliveries stay in the building, so there's no delivery cost to record.
  async function complete() {
    setBusy('delivered')
    setError(null)
    const { error } = await supabase().rpc('complete_order', { p_order_id: order.id, p_delivery_cost: 0 })
    setBusy(null)
    if (error) return setError(errorText(error))
    onChanged()
  }

  async function cancel() {
    setBusy('cancelled')
    setError(null)
    const { error } = await supabase().rpc('cancel_order', { p_order_id: order.id })
    setBusy(null)
    setConfirmCancel(false)
    if (error) return setError(errorText(error))
    onChanged()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge order={order} />
        <FulfillmentLabel fulfillment={order.fulfillment} className="text-sm font-semibold" />
        <span className="text-sm text-muted">· {formatTime(order.created_at)}</span>
      </div>

      {order.customer_arrived && !final && (
        <Notice tone="danger" icon={<BellRing size={18} strokeWidth={1.75} />} title="Customer has arrived">
          They’re at the door.
        </Notice>
      )}

      <section aria-label="Customer" className="flex flex-col gap-2">
        <a href={`tel:${order.customer_phone}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-gold-ink hover:underline">
          <Phone size={16} strokeWidth={1.75} aria-hidden /> {formatPhone(order.customer_phone)}
        </a>
        {order.payment_method === 'zelle' && (
          <p className="inline-flex min-h-11 items-center gap-2 font-semibold text-ok">
            Zelle · memo code <span className="tabular tracking-[0.15em]">{orderCode(order.id)}</span>
          </p>
        )}
        {order.payment_method === 'applepay' && (
          <p className="inline-flex min-h-11 items-center gap-2 font-semibold text-ok">
            Apple Pay · message code <span className="tabular tracking-[0.15em]">{orderCode(order.id)}</span>
          </p>
        )}
        {order.payment_method === 'cash' && (
          <p className="inline-flex min-h-11 items-center gap-2 font-semibold text-ok">
            <Banknote size={16} strokeWidth={1.75} aria-hidden /> Paying cash: collect {money(Number(order.total), { cents: true })}
          </p>
        )}
        {order.payment_method === 'cashapp' && order.cash_tag && (
          <a
            href={`https://cash.app/$${encodeURIComponent(order.cash_tag)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-ok hover:underline"
          >
            ${order.cash_tag} on Cash App <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
          </a>
        )}
        {hasAddress ? (
          <p className="inline-flex items-start gap-2 py-2 font-semibold">
            <DoorOpen size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <span>Deliver to {formatApt(order.customer_address)}</span>
          </p>
        ) : order.fulfillment === 'pickup' ? (
          <p className="inline-flex items-start gap-2 py-2">
            <MapPin size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <span>Picking up at your door</span>
          </p>
        ) : null}
        {loyalty && (
          <p className="text-sm text-muted">
            <span className="tabular">{loyalty.purchase_count}</span> past orders ·{' '}
            <span className="tabular">{loyalty.points}</span> points
          </p>
        )}
      </section>

      {(order.referral_code || reward || order.perk || order.credit_used > 0 || order.order_notes) && (
        <section aria-label="Notes" className="flex flex-col gap-2">
          {order.referral_code && (
            <Notice tone="ok" icon={<Gift size={16} strokeWidth={1.75} />} title={`Referral code ${order.referral_code}`}>
              {!order.referral_reward || order.referral_reward.toLowerCase() === 'claim later'
                ? 'Customer will claim their gift later from Rewards.'
                : `Include: ${order.referral_reward}`}
            </Notice>
          )}
          {reward && (
            <Notice tone="gold" icon={<Gift size={16} strokeWidth={1.75} />} title={`Reward: ${reward.name}`}>
              {order.reward_points} points redeemed. Include it in the bag.
            </Notice>
          )}
          {order.perk && (
            <Notice tone="gold" icon={<Gift size={16} strokeWidth={1.75} />} title="Spend perk">
              {order.perk === 'credit'
                ? 'Customer chose $7 off their next order. It’s saved automatically when this order is delivered.'
                : order.perk === 'eighth'
                  ? 'Free 1/8 is in the item list. Include it in the bag.'
                  : 'Free pre-rolls are in the item list. Include them in the bag.'}
            </Notice>
          )}
          {Number(order.credit_used) > 0 && (
            <Notice icon={<Gift size={16} strokeWidth={1.75} />} title={`Used $${Number(order.credit_used)} off from a previous order`}>
              Already taken off the total.
            </Notice>
          )}
          {order.order_notes && (
            <Notice icon={<StickyNote size={16} strokeWidth={1.75} />} title="Customer note">
              {order.order_notes}
            </Notice>
          )}
        </section>
      )}

      <section aria-label="Items" className="flex flex-col">
        <ul className="flex flex-col divide-y divide-line">
          {(order.items ?? []).map((item, i) => (
            <li key={i} className="flex justify-between gap-4 py-2.5 text-sm">
              <span>{itemLine(item)}</span>
              <span className="tabular shrink-0">{money(Number(item.line_total ?? 0), { cents: true })}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular">{money(Number(order.subtotal ?? order.total), { cents: true })}</dd>
          </div>
          {(order.discounts ?? []).map((d, i) => (
            <div key={i} className="flex justify-between text-ok">
              <dt>{d.label}</dt>
              <dd className="tabular">−{money(Number(d.amount), { cents: true })}</dd>
            </div>
          ))}
          <div className="flex justify-between pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular">{money(Number(order.total), { cents: true })}</dd>
          </div>
        </dl>
      </section>

      {error && <Notice tone="danger" title="That didn’t save">{error}</Notice>}

      {final ? (
        <p className="text-sm text-muted">
          {statusLabel(order.status, order.fulfillment)}
          {order.delivered_at && ` ${formatTime(order.delivered_at)}`}
          {order.status === 'delivered' && Number(order.delivery_cost) > 0 && ` · delivery cost ${money(Number(order.delivery_cost), { cents: true })}`}
          . This order is closed.
        </p>
      ) : (
        <section aria-label="Update status" className="flex flex-col gap-3">
          {step && step.status === 'delivered' ? (
            <Button size="lg" loading={busy === 'delivered'} onClick={complete}>{step.label}</Button>
          ) : step ? (
            <Button size="lg" loading={busy === step.status} onClick={() => setStatus(step.status)}>{step.label}</Button>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            {previous ? (
              <Button variant="ghost" size="sm" loading={busy === previous} onClick={() => setStatus(previous)}>
                <ArrowLeft size={14} strokeWidth={1.75} aria-hidden /> Back to {statusLabel(previous, order.fulfillment).toLowerCase()}
              </Button>
            ) : <span />}
            <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>Cancel order</Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => { await cancel(); onClose() }}
        title="Cancel this order?"
        body={
          <>
            {order.customer_name}’s {money(Number(order.total), { cents: true })} order will be cancelled.
            {order.reward_points > 0 && ` Their ${order.reward_points} reward points go back to their account.`}
            {order.status !== 'pending_payment' && order.payment_method !== 'cash' && ` If they already paid, refund them in ${paymentLabel(order.payment_method)}.`}
          </>
        }
        confirmLabel="Cancel order"
        tone="danger"
        loading={busy === 'cancelled'}
      />
    </div>
  )
}
