import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { cashTag, amount, secret } = await req.json()

    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!cashTag || !amount) {
      return NextResponse.json({ error: 'Missing cashTag or amount' }, { status: 400 })
    }

    const cleanTag = cashTag.replace('$', '').trim().toLowerCase()
    const cleanAmount = parseFloat(amount)

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending_payment')
      .ilike('cash_tag', cleanTag)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No matching order found' }, { status: 404 })
    }

    const matched = orders.find((o: any) => Math.abs(o.total - cleanAmount) < 0.5)

    if (!matched) {
      return NextResponse.json({ error: 'Amount does not match any pending order' }, { status: 404 })
    }

    await supabase.from('orders').update({ status: 'confirmed' }).eq('id', matched.id)

    return NextResponse.json({ success: true, orderId: matched.id, customer: matched.customer_name })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}