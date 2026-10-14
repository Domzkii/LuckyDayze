import { serviceClient } from '@/lib/supabase/server'
import { firstName, normalizePhone } from '@/lib/format'
import { InputError, str } from './http'
import type { Loyalty, Order, PublicOrder, PublicRewards } from '@/lib/types'

/** What a customer may see about an order: no phone, no delivery address. */
export function toPublicOrder(o: Order): PublicOrder {
  return {
    id: o.id,
    created_at: o.created_at,
    fulfillment: o.fulfillment,
    status: o.status,
    first_name: firstName(o.customer_name),
    pickup_location_address: o.pickup_location_address,
    items: o.items,
    subtotal: Number(o.subtotal),
    discounts: o.discounts,
    total: Number(o.total),
    customer_arrived: o.customer_arrived,
    perk: o.perk ?? null,
    payment_method: o.payment_method ?? 'cashapp',
  }
}

export function toPublicRewards(l: Loyalty): PublicRewards {
  return {
    first_name: firstName(l.customer_name),
    tier: l.membership_tier,
    points: l.points,
    purchase_count: l.purchase_count,
    referral_code: l.referral_code,
    referral_count: l.referral_count,
    referred: !!l.referred_by,
    pending_referral_reward: l.pending_referral_reward,
    membership_requested: l.membership_requested,
    house_paid_until: l.house_paid_until,
    next_order_credit: Number(l.next_order_credit ?? 0),
  }
}

export async function loyaltyForPhone(rawPhone: unknown) {
  const phone = normalizePhone(str(rawPhone, 30))
  if (!phone) throw new InputError('Please enter a 10-digit US phone number.')
  const { data, error } = await serviceClient().from('loyalty').select('*').eq('customer_phone', phone).maybeSingle()
  if (error) throw error
  return { phone, loyalty: (data ?? null) as Loyalty | null }
}
