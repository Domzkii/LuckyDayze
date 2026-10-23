import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { money, normalizePhone } from '@/lib/format'
import { InputError, handle, isUuid, readJson, str } from '@/lib/server/http'
import { notifyNewOrder } from '@/lib/server/notify'
import { pushToStaff } from '@/lib/server/push'
import type { OrderItem, Product, SecretLink } from '@/lib/types'

/** Hussein's dad's secret page: 8ths at his price, no account. See migration 0012. */

const EIGHTH = '3.5'
const SELLER_PLACE = 'From Hussein’s dad'

async function linkFor(code: string) {
  const { data, error } = await serviceClient().from('secret_links').select('*').eq('code', code.toLowerCase()).maybeSingle()
  if (error) throw error
  const link = data as SecretLink | null
  if (!link || !link.enabled) throw new InputError('This page isn’t available.', 404)
  return link
}

async function strains() {
  const { data, error } = await serviceClient()
    .from('products').select('*')
    .eq('category', 'Flower').eq('archived', false).eq('in_stock', true).gte('stock_grams', Number(EIGHTH))
    .order('name')
  if (error) throw error
  return (data ?? []) as Product[]
}

export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const link = await linkFor((await ctx.params).code)
    const menu = (await strains()).map(p => ({
      id: p.id, name: p.name, strain_type: p.strain_type, thc: p.thc, image: p.image_urls?.[0] ?? null,
      eighths: Math.floor(Number(p.stock_grams) / Number(EIGHTH)),
    }))
    return NextResponse.json({ price: Number(link.price_eighth), strains: menu })
  })
}

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const link = await linkFor((await ctx.params).code)
    const body = await readJson(request)

    const name = str(body.name, 80)
    if (name.length < 2) throw new InputError('Please enter your name.')
    const phone = normalizePhone(str(body.phone, 30))
    if (!phone) throw new InputError('Please enter a 10-digit phone number.')
    const notes = str(body.notes, 500) || null

    const raw = Array.isArray(body.lines) ? body.lines : []
    const wanted = new Map<string, number>()
    for (const r of raw.slice(0, 20)) {
      const l = (r ?? {}) as Record<string, unknown>
      const qty = Number(l.qty)
      if (!isUuid(l.productId) || !Number.isInteger(qty) || qty < 1 || qty > 20) continue
      wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + qty)
    }
    if (wanted.size === 0) throw new InputError('Pick at least one 8th.')

    const byId = new Map((await strains()).map(p => [p.id, p]))
    const price = Number(link.price_eighth)
    const items: OrderItem[] = []
    for (const [id, qty] of wanted) {
      const p = byId.get(id)
      if (!p) throw new InputError('One of those strains just sold out. Please take it off and try again.')
      if (qty * Number(EIGHTH) > Number(p.stock_grams)) {
        throw new InputError(`Only ${Math.floor(Number(p.stock_grams) / Number(EIGHTH))} 8ths of ${p.name} left.`)
      }
      items.push({ product_id: p.id, name: p.name, category: 'Flower', weight: EIGHTH, grams: Number(EIGHTH), qty, unit_price: price, line_total: price * qty })
    }
    const total = items.reduce((s, i) => s + i.line_total, 0)

    const { data, error } = await serviceClient().from('orders').insert({
      fulfillment: 'pickup',
      // He collects cash in person, so there's nothing to approve.
      status: 'confirmed',
      customer_name: name,
      customer_phone: phone,
      customer_address: null,
      pickup_location_id: null,
      pickup_location_address: SELLER_PLACE,
      order_notes: notes,
      payment_method: 'cash',
      cash_tag: null,
      items,
      subtotal: total,
      discounts: [],
      total,
      seller: link.seller,
      source: 'secret',
    }).select('id').single()
    if (error) throw error

    const count = items.reduce((n, i) => n + i.qty, 0)
    await Promise.all([
      pushToStaff({
        title: `Hussein’s dad order: ${money(total, { cents: true })}`,
        body: `${name} · ${count} × 8th · let him know`,
        tag: `order-${data.id}`,
      }),
      notifyNewOrder({
        origin: new URL(request.url).origin,
        kind: 'order',
        fulfillment: 'pickup',
        name,
        phone,
        place: SELLER_PLACE,
        items,
        discounts: [],
        total,
        paymentMethod: 'cash',
      }),
    ])

    return NextResponse.json({ id: data.id, total })
  })
}
