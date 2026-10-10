import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/format'
import { InputError, handle, readJson, str } from '@/lib/server/http'
import type { Order } from '@/lib/types'

/** Recent orders for a phone number: status and totals only, never addresses. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)
    const phone = normalizePhone(str(body.phone, 30))
    if (!phone) throw new InputError('Please enter the 10-digit phone number you ordered with.')
    const { data, error } = await serviceClient()
      .from('orders')
      .select('id, created_at, fulfillment, status, total, items')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) throw error
    const orders = ((data ?? []) as Pick<Order, 'id' | 'created_at' | 'fulfillment' | 'status' | 'total' | 'items'>[]).map(o => ({
      id: o.id,
      created_at: o.created_at,
      fulfillment: o.fulfillment,
      status: o.status,
      total: Number(o.total),
      item_count: o.items.reduce((s, i) => s + i.qty, 0),
    }))
    return NextResponse.json({ orders })
  })
}
