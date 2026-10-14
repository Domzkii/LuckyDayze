'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase/browser'
import type { AccountInfo } from './types'

/** Auth header for API calls when someone is signed in, so the server can apply their account. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type AccountState =
  | { status: 'loading' }
  | { status: 'guest' }
  /** Signed in, but the login has no customer account (e.g. staff). */
  | { status: 'no-profile'; session: Session }
  | { status: 'signed-in'; session: Session; account: AccountInfo }

/** The signed-in customer, if any. Accounts are optional, so 'guest' is the normal case. */
export function useAccount() {
  const [state, setState] = useState<AccountState>({ status: 'loading' })

  const load = useCallback(async (session: Session | null) => {
    if (!session) return setState({ status: 'guest' })
    try {
      const res = await fetch('/api/account', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (res.ok) return setState({ status: 'signed-in', session, account: await res.json() })
      setState({ status: 'no-profile', session })
    } catch {
      setState({ status: 'no-profile', session })
    }
  }, [])

  useEffect(() => {
    const client = supabase()
    client.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      // Token refreshes don't change who's signed in.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const update = useCallback((account: AccountInfo) => {
    setState(prev => (prev.status === 'signed-in' ? { ...prev, account } : prev))
  }, [])

  return { ...state, update } as AccountState & { update: (a: AccountInfo) => void }
}
