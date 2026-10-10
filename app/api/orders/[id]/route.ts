import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { fail, handle, isUuid } from '@/lib/server/http'
import { toPublicOrder } from '@/lib/server/public'
import type { Order } from '@/lib/types'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params
    if (!isUuid(id)) return fail('Order not found.', 404)
    const { data, error } = await serviceClient().from('orders').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return fail('Order not found.', 404)
    return NextResponse.json(toPublicOrder(data as Order), { headers: { 'Cache-Control': 'no-store' } })
  })
}
