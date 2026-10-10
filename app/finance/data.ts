'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/browser'
import type { InvestmentEntry, Product, ReupFund, Sale, StoreSettings, Week, WeekPayout } from '@/lib/types'

export interface FinanceData {
  sales: Sale[]
  products: Product[]
  weeks: Week[]
  payouts: WeekPayout[]
  reupFund: ReupFund | null
  investments: InvestmentEntry[]
  settings: StoreSettings | null
}

const EMPTY: FinanceData = { sales: [], products: [], weeks: [], payouts: [], reupFund: null, investments: [], settings: null }

export function useFinanceData() {
  const [data, setData] = useState<FinanceData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const db = supabase()
    const [sales, products, weeks, payouts, reup, investments, settings] = await Promise.all([
      db.from('sales').select('*').order('created_at', { ascending: false }),
      db.from('products').select('*').order('category').order('name'),
      db.from('weeks').select('*').order('created_at', { ascending: false }),
      db.from('week_payouts').select('*'),
      db.from('reup_fund').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('investment_fund').select('*').order('created_at', { ascending: false }),
      db.from('store_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    const failed = [sales, products, weeks, payouts, reup, investments, settings].find(r => r.error)
    setError(failed?.error ? `Couldn’t load finance data: ${failed.error.message}` : null)
    setData({
      sales: (sales.data ?? []) as Sale[],
      products: (products.data ?? []) as Product[],
      weeks: (weeks.data ?? []) as Week[],
      payouts: (payouts.data ?? []) as WeekPayout[],
      reupFund: (reup.data ?? null) as ReupFund | null,
      investments: (investments.data ?? []) as InvestmentEntry[],
      settings: (settings.data ?? null) as StoreSettings | null,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load()
  }, [load])

  return { data, loading, error, reload: load }
}

/** Runs Supabase writes in order and stops at the first failure. */
export async function runWrites(steps: (() => PromiseLike<{ error: { message: string } | null }>)[]) {
  for (const step of steps) {
    const { error } = await step()
    if (error) return error.message
  }
  return null
}
