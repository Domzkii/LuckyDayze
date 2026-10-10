import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { REFERRAL_BONUS_POINTS, REFERRAL_GIFTS } from '@/lib/rewards'
import { InputError, handle, readJson, str } from '@/lib/server/http'
import { loyaltyForPhone, toPublicRewards } from '@/lib/server/public'

/** Apply a friend's code from the rewards page, before a first order. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)
    const { phone, loyalty } = await loyaltyForPhone(body.phone)
    if (!loyalty) throw new InputError('No Lucky Rewards account on that number yet. Add the code at checkout instead.', 404)
    if (loyalty.referred_by) throw new InputError('This number has already used a referral code.')
    if (loyalty.purchase_count > 0) throw new InputError('Referral codes are for first orders only.')

    const code = str(body.code, 12).toUpperCase()
    if (!code) throw new InputError('Enter your friend’s code.')
    const choice = body.choice === 'grabba' || body.choice === 'plain' ? body.choice : null
    if (!choice) throw new InputError('Choose your free pre-roll.')

    const db = serviceClient()
    const { data: referrer } = await db.from('loyalty').select('customer_phone').eq('referral_code', code).maybeSingle()
    if (!referrer) throw new InputError('That referral code doesn’t exist. Check the spelling and try again.')
    if (referrer.customer_phone === phone) throw new InputError('You can’t use your own referral code.')

    const { data, error } = await db
      .from('loyalty')
      .update({
        referred_by: code,
        points: loyalty.points + REFERRAL_BONUS_POINTS,
        pending_referral_reward: REFERRAL_GIFTS[choice],
      })
      .eq('id', loyalty.id)
      .is('referred_by', null)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(toPublicRewards(data))
  })
}
