'use client'

import Image from 'next/image'
import { Gift, Leaf, ShoppingBag, Trash2 } from 'lucide-react'
import { money, weightLabel } from '@/lib/format'
import { perkNudge, perkTier, quote } from '@/lib/pricing'
import type { Product, SaleEvent, StoreSettings } from '@/lib/types'
import { useCart } from './cart'
import { QtyStepper } from './product'
import { ButtonLink, Dialog, IconButton, Notice } from './ui'

export function CartThumb({ image, reward }: { image: string | null; reward?: boolean }) {
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-sunken text-muted">
      {image ? (
        <Image src={image} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center" aria-hidden>
          {reward ? <Gift size={22} strokeWidth={1.5} /> : <Leaf size={22} strokeWidth={1.5} />}
        </span>
      )}
    </div>
  )
}

export function CartDrawer({ open, onClose, products, sale, settings }: {
  open: boolean; onClose: () => void; products: Product[]; sale: SaleEvent | null; settings: StoreSettings | null
}) {
  const { lines, setQty, remove } = useCart()
  const priced = quote(lines, products, { sale, tier: null, scheduledAhead: false })
  const byId = new Map(products.map(p => [p.id, p]))
  const minimum = Number(settings?.delivery_minimum ?? 10)
  const nudge = perkNudge(priced.merchandise)
  const tier = perkTier(priced.merchandise)
  const short = minimum - priced.merchandise

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your cart"
      variant="drawer"
      footer={
        lines.length > 0 && (
          <div className="flex flex-col gap-3">
            {priced.discounts.length > 0 && (
              <dl className="flex flex-col gap-1 text-sm">
                {priced.discounts.map(d => (
                  <div key={d.label} className="flex justify-between gap-4 text-ok">
                    <dt>{d.label}</dt>
                    <dd className="tabular">−{money(d.amount, { cents: true })}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="tabular text-xl font-semibold">{money(priced.total, { cents: true })}</span>
            </div>
            {short > 0 && (
              <p className="text-sm text-muted">Add <span className="tabular font-semibold text-ink">{money(short, { cents: true })}</span> more for delivery. Pickup has no minimum.</p>
            )}
            {tier && <p className="text-sm font-semibold text-ok">{tier === 'eighth' ? 'You unlocked a free 1/8. Pick it at checkout.' : 'You unlocked a perk. Pick it at checkout.'}</p>}
            {nudge && <p className="text-sm text-gold-ink">{nudge}</p>}
            <ButtonLink href="/checkout" size="lg" className="w-full">Checkout</ButtonLink>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center text-muted">
          <ShoppingBag size={36} strokeWidth={1.25} />
          <p className="font-semibold text-ink">Your cart is empty</p>
          <p className="text-sm">Pick a strain or a pre-roll to get started.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {lines.map(line => {
            const pricedLine = priced.lines.find(p => p.key === line.key)
            const product = line.productId ? byId.get(line.productId) : undefined
            const gone = !line.rewardKey && !pricedLine
            const maxQty = product?.category === 'Flower' && line.weight
              ? Math.max(line.qty, Math.floor((Number(product.stock_grams) - lines.filter(l => l.productId === product.id && l.key !== line.key).reduce((s, l) => s + Number(l.weight) * l.qty, 0)) / Number(line.weight)))
              : 10
            return (
              <li key={line.key} className="flex gap-4 py-4">
                <CartThumb image={line.image} reward={!!line.rewardKey} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{line.name}</p>
                      <p className="text-sm text-muted">
                        {line.rewardKey ? 'Reward, on us' : line.weight ? weightLabel(line.weight) : line.category === 'Pre-Rolls' ? 'Pre-roll' : ''}
                      </p>
                    </div>
                    <span className="tabular shrink-0 font-semibold">{line.rewardKey ? 'Free' : pricedLine ? money(pricedLine.lineTotal) : ''}</span>
                  </div>
                  {gone ? (
                    <Notice tone="warn">This just sold out. Remove it to continue.</Notice>
                  ) : null}
                  <div className="flex items-center justify-between">
                    {line.rewardKey ? <span /> : (
                      <QtyStepper label={`Quantity of ${line.name}`} value={line.qty} max={maxQty} onChange={n => setQty(line.key, n)} />
                    )}
                    <IconButton label={`Remove ${line.name}`} onClick={() => remove(line.key)}>
                      <Trash2 size={18} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
