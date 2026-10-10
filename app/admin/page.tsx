'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing, LogOut, Menu, Store, Wallet, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { StaffGate } from '@/components/staff-gate'
import { ThemeToggle } from '@/components/theme'
import { Button, IconButton, Notice, Wordmark, cx } from '@/components/ui'
import { todayInStore } from '@/lib/format'
import type { MembershipRequest, Order, ScheduledOrder } from '@/lib/types'
import { OrdersTab } from './orders'
import { ScheduledTab } from './scheduled'
import { CustomersTab } from './customers'
import { MembersTab } from './members'
import { PromosTab } from './promos'
import { Switch, errorText } from './shared'

type Tab = 'orders' | 'scheduled' | 'customers' | 'members' | 'promos'

const TABS: { key: Tab; label: string }[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'customers', label: 'Customers' },
  { key: 'members', label: 'Members' },
  { key: 'promos', label: 'Promos' },
]

export default function AdminPage() {
  return <StaffGate area="Admin">{() => <Admin />}</StaffGate>
}

interface Arrival {
  id: string
  name: string
  where: string | null
}

function Admin() {
  const [tab, setTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [scheduled, setScheduled] = useState<ScheduledOrder[]>([])
  const [scheduledLoading, setScheduledLoading] = useState(true)
  const [scheduledError, setScheduledError] = useState<string | null>(null)
  const [requests, setRequests] = useState<MembershipRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [requestsError, setRequestsError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null)
  const ordersRef = useRef<Order[]>([])

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase().from('orders').select('*').order('created_at', { ascending: false }).limit(300)
    setOrdersLoading(false)
    if (error) return setOrdersError(errorText(error))
    setOrdersError(null)
    const next = (data ?? []) as Order[]

    // A pickup customer tapping "I've arrived" flips customer_arrived; compare with what we had.
    const before = new Map(ordersRef.current.map(o => [o.id, o]))
    if (ordersRef.current.length > 0) {
      const newlyArrived = next.filter(o => o.customer_arrived && before.has(o.id) && !before.get(o.id)!.customer_arrived)
      if (newlyArrived.length) {
        setArrivals(prev => [...prev, ...newlyArrived.map(o => ({ id: o.id, name: o.customer_name, where: o.pickup_location_address }))])
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          for (const o of newlyArrived) {
            new Notification('Customer arrived', { body: `${o.customer_name} is at the door for their pickup.`, icon: '/logo-192.png' })
          }
        }
      }
    }
    ordersRef.current = next
    setOrders(next)
  }, [])

  const loadScheduled = useCallback(async () => {
    const { data, error } = await supabase().from('scheduled_orders').select('*').order('delivery_date', { ascending: true })
    setScheduledLoading(false)
    if (error) return setScheduledError(errorText(error))
    setScheduledError(null)
    setScheduled((data ?? []) as ScheduledOrder[])
  }, [])

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase().from('membership_requests').select('*').order('created_at', { ascending: false }).limit(100)
    setRequestsLoading(false)
    if (error) return setRequestsError(errorText(error))
    setRequestsError(null)
    setRequests((data ?? []) as MembershipRequest[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    loadOrders()
    loadScheduled()
    loadRequests()

    const client = supabase()
    const channel = client
      .channel('admin-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_orders' }, () => { loadScheduled() })
      .subscribe(status => setLive(status === 'SUBSCRIBED'))

    // Catch up after the phone sleeps or the tab is backgrounded.
    const onVisible = () => {
      if (document.visibilityState === 'visible') { loadOrders(); loadScheduled(); loadRequests() }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      client.removeChannel(channel)
    }
  }, [loadOrders, loadScheduled, loadRequests])

  const today = todayInStore()
  const counts: Partial<Record<Tab, { n: number; urgent?: boolean }>> = {
    orders: { n: orders.filter(o => o.status === 'pending_payment').length, urgent: true },
    scheduled: { n: scheduled.filter(s => s.status === 'pending' && s.delivery_date <= today).length, urgent: true },
    members: { n: requests.filter(r => r.status === 'pending').length },
  }

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  function onTabKey(e: React.KeyboardEvent, index: number) {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    setTab(TABS[next].key)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="min-h-dvh">
      <AdminHeader live={live} />

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-24 pt-4">
        {arrivals.map(a => (
          <Notice key={a.id} tone="danger" icon={<BellRing size={18} strokeWidth={1.75} />} title={`${a.name} has arrived`}>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span>At the door for their pickup.</span>
              <Button size="sm" variant="outline" onClick={() => { setTab('orders'); setFocusOrderId(a.id); setArrivals(p => p.filter(x => x.id !== a.id)) }}>
                Open order
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setArrivals(p => p.filter(x => x.id !== a.id))}>Dismiss</Button>
            </div>
          </Notice>
        ))}

        <div role="tablist" aria-label="Admin sections" className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none]">
          {TABS.map((t, i) => {
            const count = counts[t.key]
            const selected = tab === t.key
            return (
              <button
                key={t.key}
                ref={el => { tabRefs.current[i] = el }}
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`panel-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.key)}
                onKeyDown={e => onTabKey(e, i)}
                className={cx(
                  '-mb-px inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-[15px] font-semibold transition-colors',
                  selected ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {t.label}
                {count && count.n > 0 && (
                  <span className={cx('tabular min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs leading-none', count.urgent ? 'bg-gold text-on-gold' : 'bg-sunken text-ink')}>
                    {count.n}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'orders' && (
            <OrdersTab
              orders={orders}
              loading={ordersLoading}
              error={ordersError}
              onChanged={loadOrders}
              focusId={focusOrderId}
              onFocusHandled={() => setFocusOrderId(null)}
            />
          )}
          {tab === 'scheduled' && (
            <ScheduledTab
              scheduled={scheduled}
              loading={scheduledLoading}
              error={scheduledError}
              onChanged={() => { loadScheduled(); loadOrders() }}
              onQueued={id => { setTab('orders'); setFocusOrderId(id) }}
            />
          )}
          {tab === 'customers' && <CustomersTab />}
          {tab === 'members' && <MembersTab requests={requests} loading={requestsLoading} error={requestsError} onChanged={loadRequests} />}
          {tab === 'promos' && <PromosTab />}
        </div>
      </main>
    </div>
  )
}

function AdminHeader({ live }: { live: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifyState, setNotifyState] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only API after mount
    setNotifyState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  }, [])

  async function enableAlerts() {
    if (typeof Notification === 'undefined') return
    setNotifyState(await Notification.requestPermission())
  }

  const secondary = (
    <>
      <Link href="/finance" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
        <Wallet size={17} strokeWidth={1.75} aria-hidden /> Finance
      </Link>
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
        <Store size={17} strokeWidth={1.75} aria-hidden /> Storefront
      </Link>
      {notifyState === 'default' && (
        <button type="button" onClick={enableAlerts} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
          <Bell size={17} strokeWidth={1.75} aria-hidden /> Turn on alerts
        </button>
      )}
      <button
        type="button"
        onClick={() => supabase().auth.signOut()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink"
      >
        <LogOut size={17} strokeWidth={1.75} aria-hidden /> Sign out
      </button>
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
        <Wordmark sub="Admin" />
        {live && (
          <span className="ml-1 hidden items-center gap-1.5 text-xs font-semibold text-ok sm:inline-flex" aria-live="polite">
            <span className="size-2 rounded-full bg-ok" aria-hidden /> Live
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <StoreSwitch />
          <nav aria-label="Admin" className="hidden items-center md:flex">{secondary}</nav>
          <ThemeToggle />
          <IconButton label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="admin-menu" className="md:hidden" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
          </IconButton>
        </div>
      </div>
      {menuOpen && (
        <nav id="admin-menu" aria-label="Admin" className="mx-auto flex max-w-3xl flex-col border-t border-line px-2 py-2 md:hidden">
          {live && (
            <span className="inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-semibold text-ok">
              <span className="size-2 rounded-full bg-ok" aria-hidden /> Live updates on
            </span>
          )}
          {secondary}
        </nav>
      )}
    </header>
  )
}

function StoreSwitch() {
  const [open, setOpen] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const client = supabase()
    client.from('store_settings').select('is_open').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setOpen(data.is_open)
    })
    const channel = client
      .channel('admin-store-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_settings' }, payload => {
        const next = (payload.new as { is_open?: boolean }).is_open
        if (typeof next === 'boolean') setOpen(next)
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [])

  async function change(next: boolean) {
    setBusy(true)
    setError(null)
    const { error } = await supabase().from('store_settings').update({ is_open: next, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    if (error) return setError(errorText(error))
    setOpen(next)
  }

  if (open === null) return null
  return (
    <div className="flex items-center gap-1.5">
      <span className={cx('text-sm font-semibold', open ? 'text-ok' : 'text-muted')} aria-hidden>
        <span className="sm:hidden">{open ? 'Open' : 'Closed'}</span>
        <span className="hidden sm:inline">{open ? 'Delivery open' : 'Delivery closed'}</span>
      </span>
      <Switch checked={open} onChange={change} busy={busy} label={open ? 'Delivery open' : 'Delivery closed'} />
      {error && <span role="alert" className="text-xs font-semibold text-danger" title={error}>Didn’t save</span>}
    </div>
  )
}
