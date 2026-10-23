'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { money } from '@/lib/format'
import { Button, Dialog, Field, IconButton, Notice, inputClass } from '@/components/ui'
import type { Product } from '@/lib/types'
import { HAND_PRICE_EIGHTH, HAND_SELLER, formatWeight } from './math'

const EIGHTH_GRAMS = 3.5

/** Logs what Hussein's dad sold in person. It books into this week like any app sale. */
export function HandSaleDialog({ open, onClose, products, onDone }: {
  open: boolean; onClose: () => void; products: Product[]; onDone: () => Promise<void>
}) {
  return (
    <Dialog open={open} onClose={onClose} title={`Log ${HAND_SELLER.label}’s sales`}>
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {open && <HandSaleForm products={products} onClose={onClose} onDone={onDone} />}
    </Dialog>
  )
}

function HandSaleForm({ products, onClose, onDone }: { products: Product[]; onClose: () => void; onDone: () => Promise<void> }) {
  const strains = products.filter(p => p.category === 'Flower' && !p.archived)
  const [eighths, setEighths] = useState<Record<string, number>>({})
  const [price, setPrice] = useState(String(HAND_PRICE_EIGHTH))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceValue = Number(price)
  const priceError = !(priceValue >= 0) || price.trim() === '' ? 'Enter a price.' : null
  const count = strains.reduce((n, p) => n + (eighths[p.id] ?? 0), 0)
  const step = (id: string, by: number) => setEighths(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + by) }))

  async function save() {
    if (priceError || count === 0) return
    setBusy(true)
    setError(null)
    const items = strains
      .filter(p => (eighths[p.id] ?? 0) > 0)
      .map(p => ({ product_id: p.id, grams: eighths[p.id] * EIGHTH_GRAMS, price: eighths[p.id] * priceValue }))
    const { error } = await supabase().rpc('log_hand_sale', { p_items: items, p_seller: HAND_SELLER.key })
    if (error) {
      setBusy(false)
      return setError(`Couldn’t log the sale: ${error.message}`)
    }
    await onDone()
    setBusy(false)
    onClose()
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Counts toward this week’s revenue, profit and split, and comes out of stock, the same as an app order.
      </p>

      <Field label="Price per 8th" error={priceError}>
        {props => (
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input {...props} type="number" inputMode="decimal" min={0} value={price} onChange={e => setPrice(e.target.value)} className={`${inputClass} tabular pl-8`} />
          </div>
        )}
      </Field>

      <div className="flex flex-col">
        <div className="mb-1 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold">8ths sold</h3>
          {strains.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setEighths(Object.fromEntries(strains.map(p => [p.id, 1])))}>
              One of each
            </Button>
          )}
        </div>
        {strains.length === 0 ? (
          <p className="text-sm text-muted">No active flower strains. Add them in Products first.</p>
        ) : (
          strains.map(p => {
            const n = eighths[p.id] ?? 0
            const short = n * EIGHTH_GRAMS > (Number(p.stock_grams) || 0)
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className={`tabular text-xs ${short ? 'text-warn' : 'text-muted'}`}>
                    {short ? 'More than what’s in stock' : `In stock: ${formatWeight(Number(p.stock_grams) || 0)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton label={`One less ${p.name}`} onClick={() => step(p.id, -1)} disabled={n === 0}>
                    <Minus size={18} strokeWidth={1.75} />
                  </IconButton>
                  <span className="tabular w-6 text-center font-semibold" aria-live="polite">{n}</span>
                  <IconButton label={`One more ${p.name}`} onClick={() => step(p.id, 1)}>
                    <Plus size={18} strokeWidth={1.75} />
                  </IconButton>
                </div>
              </div>
            )
          })
        )}
        {count > 0 && (
          <div className="flex items-baseline justify-between pt-3 text-sm font-semibold">
            <span className="tabular">{count} × 8th · {formatWeight(count * EIGHTH_GRAMS)}</span>
            <span className="tabular text-gold-ink">{money(count * (priceValue || 0), { cents: true })}</span>
          </div>
        )}
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={save} loading={busy} disabled={!!priceError || count === 0}>Log sale</Button>
      </div>
    </div>
  )
}
