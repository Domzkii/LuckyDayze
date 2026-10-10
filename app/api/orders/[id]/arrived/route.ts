import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { fail, handle, isUuid } from '@/lib/server/http'

/** Customer taps "I'm at the door" for a pickup. Staff see it live in admin. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    if (!isUuid(id)) return fail('Order not found.', 404)
    const { data, error } = await serviceClient()
      .from('orders')
      .update({ customer_arrived: true })
      .eq('id', id)
      .eq('fulfillment', 'pickup')
      .in('status', ['confirmed', 'preparing', 'out_for_delivery'])
      .select('id')
    if (error) throw error
    if (!data?.length) return fail('This order isn’t ready for pickup yet.', 409)
    return NextResponse.json({ ok: true })
  })
}
