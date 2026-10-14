import { serviceClient } from '@/lib/supabase/server'
import { InputError } from './http'
import type { AccountInfo, PriceList, Profile } from '@/lib/types'

/** The signed-in user behind a request's `Authorization: Bearer` token, or null for guests. */
export async function userFromRequest(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  const { data, error } = await serviceClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** The customer's profile and special price list, or nulls for guests and staff without a profile. */
export async function accountFromRequest(request: Request) {
  const user = await userFromRequest(request)
  if (!user) return { user: null, profile: null, priceList: null }
  const db = serviceClient()
  const { data: profile } = await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
  let priceList: PriceList | null = null
  if (profile?.price_list_id) {
    const { data } = await db.from('price_lists').select('*').eq('id', profile.price_list_id).maybeSingle()
    priceList = (data ?? null) as PriceList | null
  }
  return { user, profile: (profile ?? null) as Profile | null, priceList }
}

export async function requireStaff(request: Request) {
  const user = await userFromRequest(request)
  if (!user) throw new InputError('Please sign in again.', 401)
  const { data } = await serviceClient().from('staff').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!data) throw new InputError('Staff only.', 403)
  return user
}

export function toAccountInfo(profile: Profile, priceList: PriceList | null): AccountInfo {
  const prices = priceList && Object.values(priceList.prices ?? {}).some(p => Number(p) > 0) ? priceList.prices : null
  return {
    email: profile.email,
    name: profile.name,
    phone: profile.phone,
    kind: profile.kind,
    apt: profile.apt,
    street_address: profile.street_address,
    prices,
  }
}
