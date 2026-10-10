import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { HOUSE_MIN_ORDERS, HOUSE_MIN_POINTS, MEMBER_MIN_ORDERS } from '@/lib/rewards'
import { InputError, handle, readJson, str } from '@/lib/server/http'
import { loyaltyForPhone, toPublicRewards } from '@/lib/server/public'

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)
    const { phone, loyalty } = await loyaltyForPhone(body.phone)
    if (!loyalty) throw new InputError('No Lucky Rewards account on that number yet.', 404)

    const tier = body.tier === 'house' ? 'house' : body.tier === 'member' ? 'member' : null
    if (!tier) throw new InputError('Choose a membership.')
    if (loyalty.membership_requested) throw new InputError('You already have a request in. We’ll be in touch soon.')
    if (tier === 'member' && !(loyalty.membership_tier === 'guest' && loyalty.purchase_count >= MEMBER_MIN_ORDERS)) {
      throw new InputError(`Member opens up after ${MEMBER_MIN_ORDERS} orders.`)
    }
    if (tier === 'house' && !(loyalty.membership_tier === 'member' && loyalty.purchase_count >= HOUSE_MIN_ORDERS && loyalty.points >= HOUSE_MIN_POINTS)) {
      throw new InputError(`The House opens up for Members with ${HOUSE_MIN_ORDERS} orders and ${HOUSE_MIN_POINTS} points.`)
    }

    const name = str(body.name, 80) || loyalty.customer_name
    const email = str(body.email, 120)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Please enter a valid email address.')
    const birthday = str(body.birthday, 10)
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw new InputError('Please enter your birthday as a date.')

    const db = serviceClient()
    const { error } = await db.from('membership_requests').insert({
      customer_phone: phone,
      customer_name: name,
      customer_email: email,
      customer_birthday: birthday || null,
      requested_tier: tier,
    })
    if (error) throw error
    const { data: updated, error: updateError } = await db
      .from('loyalty')
      .update({ membership_requested: tier, email, birthday: birthday || null })
      .eq('id', loyalty.id)
      .select('*')
      .single()
    if (updateError) throw updateError
    return NextResponse.json(toPublicRewards(updated))
  })
}
