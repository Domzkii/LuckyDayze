'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CartLine } from '@/lib/pricing'

const STORAGE_KEY = 'ld_cart'

interface CartContextValue {
  lines: CartLine[]
  ready: boolean
  count: number
  add: (line: Omit<CartLine, 'key'>) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function lineKey(line: Omit<CartLine, 'key'>) {
  return line.rewardKey ? `reward:${line.rewardKey}` : `${line.productId}:${line.weight ?? 'unit'}`
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from storage after mount
      if (Array.isArray(saved)) setLines(saved)
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)) } catch {}
  }, [lines, ready])

  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = lineKey(line)
    setLines(prev => {
      const existing = prev.find(l => l.key === key)
      if (existing) {
        if (line.rewardKey) return prev
        return prev.map(l => (l.key === key ? { ...l, qty: l.qty + line.qty } : l))
      }
      return [...prev, { ...line, key }]
    })
  }, [])

  const setQty = useCallback((key: string, qty: number) => {
    setLines(prev => (qty < 1 ? prev.filter(l => l.key !== key) : prev.map(l => (l.key === key ? { ...l, qty } : l))))
  }, [])

  const remove = useCallback((key: string) => setLines(prev => prev.filter(l => l.key !== key)), [])
  const clear = useCallback(() => setLines([]), [])

  const value = useMemo(
    () => ({ lines, ready, count: lines.reduce((s, l) => s + l.qty, 0), add, setQty, remove, clear }),
    [lines, ready, add, setQty, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
