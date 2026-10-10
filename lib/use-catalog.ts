'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase/browser'
import type { Product, SaleEvent, StoreSettings } from './types'

export interface Catalog {
  products: Product[]
  settings: StoreSettings | null
  sale: SaleEvent | null
}

const EMPTY: Catalog = { products: [], settings: null, sale: null }

/** The public storefront data. Refreshes when the app comes back to the foreground. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async () => {
    try {
      const db = supabase()
      const [products, settings, sale] = await Promise.all([
        db.from('products').select('*').eq('archived', false).order('created_at'),
        db.from('store_settings').select('*').eq('id', 1).maybeSingle(),
        db.from('sales_events').select('*').eq('is_active', true).maybeSingle(),
      ])
      if (products.error || settings.error) throw products.error || settings.error
      setCatalog({
        products: (products.data ?? []) as Product[],
        settings: (settings.data ?? null) as StoreSettings | null,
        sale: (sale.data ?? null) as SaleEvent | null,
      })
      setStatus('ready')
    } catch (err) {
      console.error('Catalog load failed', err)
      setStatus(prev => (prev === 'ready' ? 'ready' : 'error'))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  return { ...catalog, status, reload: load }
}

/** Products a customer can actually buy right now. */
export function availableProducts(products: Product[]) {
  const flowerGrams = products.filter(p => p.category === 'Flower').reduce((s, p) => s + Number(p.stock_grams || 0), 0)
  return {
    flower: products.filter(p => p.category === 'Flower' && p.in_stock && Number(p.stock_grams) > 0),
    preRolls: products.filter(p => p.category === 'Pre-Rolls' && p.in_stock && flowerGrams > 0),
  }
}
