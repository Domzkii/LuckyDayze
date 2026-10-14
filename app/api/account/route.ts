import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/format'
import { accountFromRequest, toAccountInfo } from '@/lib/server/auth'
import { InputError, handle, readJson, str } from '@/lib/server/http'

/** The signed-in customer's account. */
export async function GET(request: Request) {
  return handle(async () => {
    const { user, profile, priceList } = await accountFromRequest(request)
    if (!user) throw new InputError('Please sign in.', 401)
    if (!profile) throw new InputError('This login doesn’t have a customer account.', 404)
    return NextResponse.json(toAccountInfo(profile, priceList))
  })
}

/** Update name, phone and where we deliver. Friends edit their street address; building residents their apartment. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { user, profile, priceList } = await accountFromRequest(request)
    if (!user) throw new InputError('Please sign in.', 401)
    if (!profile) throw new InputError('This login doesn’t have a customer account.', 404)
    const body = await readJson(request)

    const name = str(body.name, 80)
    if (name.length < 2) throw new InputError('Please enter your name.')
    const phone = normalizePhone(str(body.phone, 30))
    if (!phone) throw new InputError('Please enter a 10-digit US phone number.')
    const patch: Record<string, string> = { name, phone }
    if (profile.kind === 'friend') {
      const street = str(body.street_address, 120)
      if (street.length < 5) throw new InputError('Please enter your street address.')
      patch.street_address = street
    } else {
      const apt = str(body.apt, 20)
      if (!apt) throw new InputError('Please enter your apartment number.')
      patch.apt = apt
    }

    const { data, error } = await serviceClient().from('profiles').update(patch).eq('user_id', user.id).select('*').single()
    if (error) {
      if (error.code === '23505') throw new InputError('That phone number is on another account.')
      throw error
    }
    return NextResponse.json(toAccountInfo(data, priceList))
  })
}
