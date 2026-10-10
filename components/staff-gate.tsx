'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/browser'
import { Button, Field, Notice, Spinner, Wordmark, inputClass } from './ui'
import { ThemeToggle } from './theme'

type GateState = 'loading' | 'signed-out' | 'not-staff' | 'staff'

/**
 * Real staff sign-in (Supabase Auth). The database also checks staff membership on every
 * query, so this screen is a convenience, not the lock.
 */
export function StaffGate({ area, children }: { area: string; children: (session: Session) => React.ReactNode }) {
  const [state, setState] = useState<GateState>('loading')
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const client = supabase()
    async function check(s: Session | null) {
      setSession(s)
      if (!s) return setState('signed-out')
      const { data } = await client.from('staff').select('user_id').eq('user_id', s.user.id).maybeSingle()
      setState(data ? 'staff' : 'not-staff')
    }
    client.auth.getSession().then(({ data }) => check(data.session))
    const { data: sub } = client.auth.onAuthStateChange((_event, s) => { check(s) })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (state === 'loading') return <main className="min-h-dvh"><Spinner /></main>
  if (state === 'staff' && session) return <>{children(session)}</>
  return <SignIn area={area} notStaff={state === 'not-staff'} email={session?.user.email} />
}

function SignIn({ area, notStaff, email: signedInEmail }: { area: string; notStaff: boolean; email?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError('That email and password don’t match a staff account.')
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Wordmark sub={area} size="lg" />
        </div>
        {notStaff ? (
          <div className="flex flex-col gap-4">
            <Notice tone="warn" title="This account isn’t on the staff list">
              {signedInEmail} is signed in, but hasn’t been added as staff. Ask an owner to add you, then sign in again.
            </Notice>
            <Button variant="outline" onClick={() => supabase().auth.signOut()}>Sign out</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
            <h1 className="display text-2xl font-semibold">Staff sign in</h1>
            <Field label="Email">
              {props => <input {...props} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Password" error={error}>
              {props => <input {...props} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />}
            </Field>
            <Button type="submit" size="lg" loading={busy} className="mt-1">Sign in</Button>
          </form>
        )}
      </div>
    </main>
  )
}
