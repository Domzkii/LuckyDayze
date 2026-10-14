import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/format'
import { InputError, handle, readJson, str } from '@/lib/server/http'
import type { Invite } from '@/lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function findInvite(code: string) {
  if (!code) return null
  const { data } = await serviceClient().from('invites').select('*').eq('code', code.toUpperCase()).maybeSingle()
  return (data ?? null) as Invite | null
}

/** Is this invite code good? The sign-up page asks before showing the friend form. */
export async function GET(request: Request) {
  return handle(async () => {
    const invite = await findInvite(str(new URL(request.url).searchParams.get('invite'), 20))
    if (!invite) return NextResponse.json({ valid: false, reason: 'That invite link isn’t valid. Ask for a new one.' })
    if (invite.used_by) return NextResponse.json({ valid: false, reason: 'That invite link was already used. Ask for a new one.' })
    return NextResponse.json({ valid: true })
  })
}

/**
 * Creates the login and the profile together. The user is created already confirmed,
 * so no email goes out; the browser signs in with the password right after.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request)
    const db = serviceClient()

    const name = str(body.name, 80)
    if (name.length < 2) throw new InputError('Please enter your name.')
    const phone = normalizePhone(str(body.phone, 30))
    if (!phone) throw new InputError('Please enter a 10-digit US phone number.')
    const email = str(body.email, 120).toLowerCase()
    if (!EMAIL_RE.test(email)) throw new InputError('Please enter a real email address. It’s how you sign in.')
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 8) throw new InputError('Use at least 8 characters for your password.')

    // An invite makes this a friend account with a street address; otherwise it's a building account.
    const inviteCode = str(body.invite, 20)
    const invite = inviteCode ? await findInvite(inviteCode) : null
    if (inviteCode && (!invite || invite.used_by)) throw new InputError('That invite link isn’t valid anymore. Ask for a new one.')
    const kind = invite ? 'friend' : 'building'
    const apt = kind === 'building' ? str(body.apt, 20) : ''
    const street = kind === 'friend' ? str(body.street_address, 120) : ''
    if (kind === 'building' && !apt) throw new InputError('Please enter your apartment number.')
    if (kind === 'friend' && street.length < 5) throw new InputError('Please enter your street address.')

    const { data: taken } = await db.from('profiles').select('user_id').eq('phone', phone).maybeSingle()
    if (taken) throw new InputError('That phone number already has an account. Sign in instead.')

    const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (createError || !created.user) {
      if (createError?.message?.toLowerCase().includes('already')) throw new InputError('That email already has an account. Sign in instead.')
      if (createError?.message?.toLowerCase().includes('password')) throw new InputError(createError.message)
      throw createError ?? new Error('createUser returned no user')
    }
    const userId = created.user.id

    const { error: profileError } = await db.from('profiles').insert({
      user_id: userId,
      email,
      name,
      phone,
      kind,
      apt: apt || null,
      street_address: street || null,
      price_list_id: invite?.price_list_id ?? null,
    })
    if (profileError) {
      await db.auth.admin.deleteUser(userId)
      if (profileError.code === '23505') throw new InputError('That phone number already has an account. Sign in instead.')
      throw profileError
    }

    if (invite) {
      // Claim the invite; if someone beat us to it, undo this sign-up.
      const { data: claimed } = await db.from('invites')
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq('code', invite.code).is('used_by', null).select('code')
      if (!claimed?.length) {
        await db.auth.admin.deleteUser(userId)
        throw new InputError('That invite link was just used. Ask for a new one.')
      }
    }

    return NextResponse.json({ ok: true })
  })
}
