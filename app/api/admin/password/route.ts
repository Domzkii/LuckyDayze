import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/server/auth'
import { InputError, handle, isUuid, readJson } from '@/lib/server/http'

/** Staff set a new password for a customer who forgot theirs (there are no reset emails). */
export async function POST(request: Request) {
  return handle(async () => {
    await requireStaff(request)
    const body = await readJson(request)
    if (!isUuid(body.userId)) throw new InputError('Unknown account.')
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 8) throw new InputError('Use at least 8 characters.')
    const db = serviceClient()
    const { data: profile } = await db.from('profiles').select('user_id').eq('user_id', body.userId).maybeSingle()
    if (!profile) throw new InputError('Only customer accounts can be reset here.')
    const { error } = await db.auth.admin.updateUserById(body.userId, { password })
    if (error) throw new InputError(error.message)
    return NextResponse.json({ ok: true })
  })
}
