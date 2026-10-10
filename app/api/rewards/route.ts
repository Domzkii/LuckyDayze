import { NextResponse } from 'next/server'
import { fail, handle, readJson } from '@/lib/server/http'
import { loyaltyForPhone, toPublicRewards } from '@/lib/server/public'

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)
    const { loyalty } = await loyaltyForPhone(body.phone)
    if (!loyalty) return fail('No Lucky Rewards account on that number yet. Your first order starts one.', 404)
    return NextResponse.json(toPublicRewards(loyalty))
  })
}
