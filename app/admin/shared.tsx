'use client'

import { CalendarClock, MapPin, Truck } from 'lucide-react'
import { Badge } from '@/components/ui'
import { weightLabel } from '@/lib/format'
import type { Fulfillment, Order, OrderItem, OrderStatus } from '@/lib/types'

export const ACTIVE_STATUSES: OrderStatus[] = ['pending_payment', 'confirmed', 'preparing', 'out_for_delivery']

export function statusLabel(status: OrderStatus, fulfillment: Fulfillment, payment?: string) {
  switch (status) {
    case 'pending_payment': return payment === 'cash' ? 'Cash: needs approval' : 'Awaiting payment'
    case 'confirmed': return 'Confirmed'
    case 'preparing': return 'Preparing'
    case 'out_for_delivery': return fulfillment === 'pickup' ? 'Ready for pickup' : 'Out for delivery'
    case 'delivered': return fulfillment === 'pickup' ? 'Picked up' : 'Delivered'
    case 'cancelled': return 'Cancelled'
  }
}

const statusTones = {
  pending_payment: 'warn',
  confirmed: 'neutral',
  preparing: 'neutral',
  out_for_delivery: 'gold',
  delivered: 'ok',
  cancelled: 'danger',
} as const

export function StatusBadge({ order }: { order: Pick<Order, 'status' | 'fulfillment'> & { payment_method?: string } }) {
  return <Badge tone={statusTones[order.status]}>{statusLabel(order.status, order.fulfillment, order.payment_method)}</Badge>
}

const fulfillmentMeta: Record<Fulfillment, { label: string; Icon: typeof Truck }> = {
  delivery: { label: 'Delivery', Icon: Truck },
  pickup: { label: 'Pickup', Icon: MapPin },
  scheduled: { label: 'Scheduled', Icon: CalendarClock },
}

export function FulfillmentLabel({ fulfillment, className = '' }: { fulfillment: Fulfillment; className?: string }) {
  const { label, Icon } = fulfillmentMeta[fulfillment] ?? fulfillmentMeta.delivery
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon size={15} strokeWidth={1.75} aria-hidden />
      {label}
    </span>
  )
}

export function itemLine(item: OrderItem) {
  const weight = item.weight ? ` · ${weightLabel(item.weight)}` : ''
  return `${item.name}${weight} × ${item.qty}${item.is_reward ? ' (reward)' : ''}`
}

export function itemSummary(items: OrderItem[] | null | undefined) {
  return Array.isArray(items) ? items.map(itemLine).join(', ') : ''
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <span className="text-muted" aria-hidden>{icon}</span>
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-xs text-sm text-muted">{children}</p>}
    </div>
  )
}

/** Accessible on/off toggle. */
export function Switch({
  checked, onChange, label, disabled, busy,
}: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-full px-1 disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${checked ? 'bg-ok' : 'bg-line-strong'}`}
      >
        <span
          className={`absolute size-5 rounded-full bg-canvas shadow-lift transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </button>
  )
}

export function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return 'Something went wrong. Try again.'
}

/** YYYY-MM-DD, n days after today in the store's time zone. */
export function daysFromToday(today: string, n: number) {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + n))
  return date.toISOString().slice(0, 10)
}
