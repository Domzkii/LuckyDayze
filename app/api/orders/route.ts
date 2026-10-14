import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { FREQUENCIES, MAX_SCHEDULE_DAYS, PAYMENT_METHODS, PICKUP_PLACE, TIME_WINDOWS, WEIGHTS, formatApt, normalizePhone, todayInStore } from '@/lib/format'
import { quote, type CartLine } from '@/lib/pricing'
import {
  REFERRAL_BONUS_POINTS, REFERRAL_GIFTS, REFERRAL_REWARD_KEY, SIGNUP_POINTS, rewardByKey, type ReferralChoice,
} from '@/lib/rewards'
import { InputError, handle, isUuid, randomCode, readJson, str } from '@/lib/server/http'
import { notifyNewOrder } from '@/lib/server/notify'
import type { Fulfillment, Frequency, Loyalty, OrderItem, PaymentMethod, Product, SaleEvent, StoreSettings } from '@/lib/types'

const CASHTAG_RE = /^[A-Za-z][A-Za-z0-9_-]{0,19}$/

function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function parseLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new InputError('Your cart is empty.')
  if (raw.length > 30) throw new InputError('That’s more items than we can take in one order.')
  return raw.map((r, i) => {
    const l = (r ?? {}) as Record<string, unknown>
    const qty = Number(l.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new InputError('Please check the quantities in your cart.')
    const rewardKey = str(l.rewardKey, 40) || undefined
    const productId = isUuid(l.productId) ? l.productId : null
    if (!rewardKey && !productId) throw new InputError('Your cart has an item we don’t recognize. Please remove it and try again.')
    if (!rewardKey && l.category === 'Flower' && !(WEIGHTS as readonly unknown[]).includes(l.weight)) {
      throw new InputError('One of the sizes in your cart isn’t on the menu anymore. Please remove it and add it again.')
    }
    return {
      key: `line-${i}`,
      productId,
      name: str(l.name, 120),
      category: l.category === 'Flower' ? 'Flower' : 'Pre-Rolls',
      weight: typeof l.weight === 'string' ? l.weight : null,
      qty: rewardKey ? 1 : qty,
      image: null,
      rewardKey,
    }
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)
    const db = serviceClient()

    // ── Who and how ──
    const fulfillment = body.fulfillment as Fulfillment
    if (!['delivery', 'pickup', 'scheduled'].includes(fulfillment)) throw new InputError('Choose delivery, pickup or scheduled.')
    const name = str(body.name, 80)
    if (name.length < 2) throw new InputError('Please enter your name.')
    const phone = normalizePhone(str(body.phone, 30))
    if (!phone) throw new InputError('Please enter a 10-digit US phone number.')
    const paymentMethod = str(body.paymentMethod, 10) as PaymentMethod
    if (!PAYMENT_METHODS.some(m => m.value === paymentMethod)) throw new InputError('Choose how you’ll pay: Cash App, Zelle or cash.')
    let cashTag: string | null = null
    if (paymentMethod === 'cashapp') {
      cashTag = str(body.cashTag, 30).replace(/^\$/, '').replace(/\s/g, '')
      if (!CASHTAG_RE.test(cashTag)) throw new InputError('Please enter your Cash App $Cashtag so we can match your payment.')
    }
    const notes = str(body.notes, 500) || null
    const address = str(body.address, 40)

    const lines = parseLines(body.lines)
    const productIds = [...new Set(lines.map(l => l.productId).filter((id): id is string => !!id))]

    const [settingsRes, productsRes, saleRes, loyaltyRes] = await Promise.all([
      db.from('store_settings').select('*').eq('id', 1).single(),
      productIds.length ? db.from('products').select('*').in('id', productIds) : Promise.resolve({ data: [] as Product[], error: null }),
      db.from('sales_events').select('*').eq('is_active', true).maybeSingle(),
      db.from('loyalty').select('*').eq('customer_phone', phone).maybeSingle(),
    ])
    if (settingsRes.error) throw settingsRes.error
    if (productsRes.error) throw productsRes.error
    const settings = settingsRes.data as StoreSettings
    const products = (productsRes.data ?? []) as Product[]
    const sale = (saleRes.data ?? null) as SaleEvent | null
    let loyalty = (loyaltyRes.data ?? null) as Loyalty | null

    let place = ''
    let scheduledDate = ''
    let timeWindow: string | null = null
    let frequency: Frequency = 'once'
    const today = todayInStore()

    if (fulfillment === 'delivery') {
      if (!settings.is_open) throw new InputError('Delivery is closed right now. Pickup and scheduled delivery are still open.')
      if (!address) throw new InputError('Please enter your apartment number.')
      place = formatApt(address)
    } else if (fulfillment === 'pickup') {
      place = PICKUP_PLACE
    } else {
      if (!address) throw new InputError('Please enter your apartment number.')
      scheduledDate = str(body.scheduledDate, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) || scheduledDate < today || scheduledDate > addDays(today, MAX_SCHEDULE_DAYS)) {
        throw new InputError(`Please pick a delivery date within the next ${MAX_SCHEDULE_DAYS} days.`)
      }
      timeWindow = (TIME_WINDOWS as readonly string[]).includes(str(body.timeWindow, 40)) ? str(body.timeWindow, 40) : null
      const f = str(body.frequency, 10)
      frequency = FREQUENCIES.some(o => o.value === f) ? (f as Frequency) : 'once'
      place = formatApt(address)
    }

    // ── Stock ──
    const byId = new Map(products.map(p => [p.id, p]))
    const gramsWanted = new Map<string, number>()
    for (const l of lines) {
      if (l.rewardKey || !l.productId) continue
      const p = byId.get(l.productId)
      if (!p || p.archived || !p.in_stock) throw new InputError(`${l.name || 'An item in your cart'} just sold out. Please remove it to continue.`)
      if (p.category === 'Flower') {
        gramsWanted.set(p.id, (gramsWanted.get(p.id) ?? 0) + Number(l.weight ?? '3.5') * l.qty)
      }
    }
    for (const [id, grams] of gramsWanted) {
      const p = byId.get(id)!
      if (grams > Number(p.stock_grams)) throw new InputError(`We only have ${Math.floor(Number(p.stock_grams))}g of ${p.name} left. Please lower the amount.`)
    }

    // ── Rewards ──
    let rewardPoints = 0
    let rewardKey: string | null = null
    let clearsReferralGift = false
    const rewardLines = lines.filter(l => l.rewardKey)
    if (rewardLines.filter(l => l.rewardKey !== REFERRAL_REWARD_KEY).length > 1) throw new InputError('Only one points reward can be used per order.')
    for (const l of rewardLines) {
      if (l.rewardKey === REFERRAL_REWARD_KEY) {
        if (!loyalty?.pending_referral_reward) throw new InputError('There’s no referral gift waiting on this phone number.')
        l.name = loyalty.pending_referral_reward
        l.category = 'Pre-Rolls'
        clearsReferralGift = true
        continue
      }
      const reward = rewardByKey(l.rewardKey!)
      if (!reward) throw new InputError('That reward isn’t available.')
      if (fulfillment === 'scheduled') throw new InputError('Points rewards can be used on delivery or pickup orders, not scheduled ones.')
      if (!loyalty) throw new InputError('Rewards need an existing Lucky Rewards account on this phone number.')
      if (loyalty.points < reward.points) throw new InputError(`${reward.name} needs ${reward.points} points. This number has ${loyalty.points}.`)
      l.name = reward.name
      l.category = reward.category
      rewardPoints = reward.points
      rewardKey = reward.key
    }

    // ── Referral code (first orders only) ──
    let referralCode: string | null = null
    let referralReward: string | null = null
    const code = str(body.referralCode, 12).toUpperCase()
    const choice = str(body.referralChoice, 10) as ReferralChoice
    if (code) {
      if (loyalty && (loyalty.purchase_count > 0 || loyalty.referred_by)) throw new InputError('Referral codes are for first orders only.')
      const { data: referrer } = await db.from('loyalty').select('customer_phone').eq('referral_code', code).maybeSingle()
      if (!referrer) throw new InputError('That referral code doesn’t exist. Check the spelling and try again.')
      if (referrer.customer_phone === phone) throw new InputError('You can’t use your own referral code.')
      if (!['grabba', 'plain', 'later'].includes(choice)) throw new InputError('Choose your free pre-roll, or save it for later.')
      referralCode = code
      if (choice === 'later') {
        referralReward = 'Claim later'
      } else {
        referralReward = REFERRAL_GIFTS[choice]
        lines.push({ key: 'referral-gift', productId: null, name: referralReward, category: 'Pre-Rolls', weight: null, qty: 1, image: null, rewardKey: REFERRAL_REWARD_KEY })
      }
    }

    // ── The one deal ──
    // Each order gets one deal: the spend perk, a promo or banked credit, whichever is worth most
    // to the customer. lib/pricing decides.
    const banked = fulfillment !== 'scheduled' ? Number(loyalty?.next_order_credit ?? 0) : 0

    // ── Price it ──
    const priced = quote(lines, products, { sale, credit: banked })
    const creditUsed = priced.discounts.find(d => d.kind === 'credit')?.amount ?? 0
    if (priced.lines.length === 0) throw new InputError('Your cart is empty.')
    if (fulfillment !== 'pickup' && priced.merchandise < Number(settings.delivery_minimum)) {
      throw new InputError(`Delivery starts at $${Number(settings.delivery_minimum)}. Add a little more, or switch to pickup.`)
    }

    const items: OrderItem[] = priced.lines.map(l => ({
      product_id: l.productId,
      name: l.name,
      category: l.category,
      weight: l.weight,
      grams: l.grams,
      qty: l.qty,
      unit_price: l.unitPrice,
      line_total: l.lineTotal,
      ...(l.rewardKey ? { is_reward: true, reward_key: l.rewardKey } : {}),
    }))

    // ── Loyalty bookkeeping ──
    if (rewardPoints > 0 && loyalty) {
      const { data: spent } = await db
        .from('loyalty')
        .update({ points: loyalty.points - rewardPoints })
        .eq('id', loyalty.id)
        .gte('points', rewardPoints)
        .select('id')
      if (!spent?.length) throw new InputError('Your points changed while you were checking out. Please try again.')
    }

    if (!loyalty) {
      const { data, error } = await db.from('loyalty').insert({
        customer_phone: phone,
        customer_name: name,
        points: SIGNUP_POINTS + (referralCode ? REFERRAL_BONUS_POINTS : 0),
        referral_code: randomCode(),
        referred_by: referralCode,
        pending_referral_reward: referralCode && choice === 'later' ? `${REFERRAL_GIFTS.grabba} or ${REFERRAL_GIFTS.plain}` : null,
      }).select('*').single()
      if (error) throw error
      loyalty = data as Loyalty
    } else {
      const patch: Partial<Loyalty> = {}
      if (referralCode) {
        patch.referred_by = referralCode
        patch.points = loyalty.points - rewardPoints + REFERRAL_BONUS_POINTS
        if (choice === 'later') patch.pending_referral_reward = `${REFERRAL_GIFTS.grabba} or ${REFERRAL_GIFTS.plain}`
      }
      if (clearsReferralGift) patch.pending_referral_reward = null
      if (creditUsed > 0) patch.next_order_credit = 0
      if (Object.keys(patch).length) await db.from('loyalty').update(patch).eq('id', loyalty.id)
    }

    // ── Save ──
    const common = {
      customer_name: name,
      customer_phone: phone,
      order_notes: notes,
      payment_method: paymentMethod,
      cash_tag: cashTag,
      items,
      subtotal: priced.subtotal,
      discounts: priced.discounts,
      total: priced.total,
      referral_code: referralCode,
      referral_reward: referralReward,
    }

    let id: string
    if (fulfillment === 'scheduled') {
      const { data, error } = await db.from('scheduled_orders').insert({
        ...common,
        customer_address: address,
        delivery_date: scheduledDate,
        delivery_time_window: timeWindow,
        frequency,
      }).select('id').single()
      if (error) throw error
      id = data.id
    } else {
      const { data, error } = await db.from('orders').insert({
        ...common,
        fulfillment,
        // Cash orders wait here too, until staff approve them.
        status: priced.total > 0 ? 'pending_payment' : 'confirmed',
        customer_address: fulfillment === 'delivery' ? address : null,
        pickup_location_id: null,
        pickup_location_address: fulfillment === 'pickup' ? PICKUP_PLACE : null,
        reward_key: rewardKey,
        reward_points: rewardPoints,
        credit_used: creditUsed,
      }).select('id').single()
      if (error) {
        if (rewardPoints > 0 || creditUsed > 0) {
          await db.from('loyalty').update({ points: loyalty.points, next_order_credit: loyalty.next_order_credit }).eq('id', loyalty.id)
        }
        throw error
      }
      id = data.id
    }

    await notifyNewOrder({
      origin: new URL(request.url).origin,
      kind: fulfillment === 'scheduled' ? 'scheduled' : 'order',
      fulfillment,
      name,
      phone,
      place,
      items,
      discounts: priced.discounts,
      total: priced.total,
      paymentMethod,
      deliveryDate: scheduledDate || undefined,
      timeWindow,
      frequency,
    })

    return NextResponse.json({ id, kind: fulfillment === 'scheduled' ? 'scheduled' : 'order', total: priced.total })
  })
}
