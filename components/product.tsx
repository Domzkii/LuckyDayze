'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Flame, Leaf, Minus, Plus } from 'lucide-react'
import { WEIGHTS, WEIGHT_LABELS, money } from '@/lib/format'
import { PREROLL_DEAL, startingPrice, unitPriceFor } from '@/lib/pricing'
import type { Product } from '@/lib/types'
import { useCart } from './cart'
import { Badge, Button, Dialog, Segmented, cx } from './ui'

const LOW_STOCK_GRAMS = 14

export function StrainBadge({ type }: { type: Product['strain_type'] }) {
  const tone = type === 'Sativa' ? 'warn' : type === 'Indica' ? 'indica' : 'ok'
  return <Badge tone={tone}>{type}</Badge>
}

export function ProductImage({ product, index = 0, sizes, className = '', priority }: {
  product: Product; index?: number; sizes: string; className?: string; priority?: boolean
}) {
  const url = product.image_urls?.[index]
  if (!url) return <LabelTile product={product} className={className} />
  return (
    <div className={cx('relative overflow-hidden bg-sunken', className)}>
      <Image src={url} alt={product.name} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  )
}

const TILE_TONES: Record<Product['strain_type'], string> = {
  Sativa: 'bg-warn-tint text-warn',
  Indica: 'bg-indica-tint text-indica',
  Hybrid: 'bg-ok-tint text-ok',
}

/**
 * Stand-in for a missing photo: a jar label. Monogram in the display face on the strain's tint.
 * Pre-rolls read "PR" with their variant ("No Grabba") underneath.
 */
function LabelTile({ product, className = '' }: { product: Product; className?: string }) {
  const [base, variant] = product.name.split(/\s*\((.+)\)\s*$/)
  const words = base.replace(/-/g, ' ').split(/\s+/).filter(Boolean)
  const monogram = (words.length > 1 ? words[0][0] + words[1][0] : base.slice(0, 2)).toUpperCase()
  const caption = variant ?? (product.category === 'Flower' ? product.strain_type : 'Pre-roll')
  return (
    <div className={cx('relative flex flex-col items-center justify-center overflow-hidden', TILE_TONES[product.strain_type], className)} aria-hidden>
      <span className="absolute inset-3 rounded-[inherit] border border-current opacity-20" />
      <Leaf size={18} strokeWidth={1.5} className="mb-3 opacity-50" />
      <span className="display text-[clamp(2.75rem,9vw,4.5rem)] font-medium italic leading-none tracking-tight">{monogram}</span>
      <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] opacity-75">{caption}</span>
    </div>
  )
}

export function dealLabel(product: Product) {
  if (product.category !== 'Pre-Rolls') return null
  return PREROLL_DEAL.short
}

export function ProductCard({ product, onOpen, priority }: { product: Product; onOpen: () => void; priority?: boolean }) {
  const isFlower = product.category === 'Flower'
  const low = isFlower && Number(product.stock_grams) < LOW_STOCK_GRAMS
  const deal = dealLabel(product)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-lift"
    >
      <div className="relative">
        <ProductImage
          product={product}
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw"
          className="aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          priority={priority}
        />
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {product.is_popular && <Badge tone="gold"><Flame size={12} strokeWidth={2} /> Popular</Badge>}
          {low && <Badge tone="warn" className="bg-warn-tint/95">Almost gone</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <h3 className="display text-[17px] font-semibold leading-tight sm:text-lg">{product.name}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <StrainBadge type={product.strain_type} />
          {product.thc && product.thc !== '—' && <span className="text-xs font-semibold text-muted">THC {product.thc}</span>}
        </div>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
          <span className="tabular text-[15px] font-semibold">
            {isFlower && <span className="font-normal text-muted">from </span>}
            {money(startingPrice(product))}
          </span>
          {deal && <span className="text-xs font-semibold text-ok">{deal}</span>}
        </div>
      </div>
    </button>
  )
}

export function QtyStepper({ value, min = 1, max, onChange, label }: {
  value: number; min?: number; max: number; onChange: (n: number) => void; label: string
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sunken disabled:opacity-35"
      >
        <Minus size={16} strokeWidth={2} />
      </button>
      <span className="tabular w-7 text-center font-semibold" aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sunken disabled:opacity-35"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

function Gallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const urls = product.image_urls ?? []

  if (urls.length <= 1) {
    return <ProductImage product={product} sizes="(min-width: 640px) 512px, 100vw" className="aspect-square w-full rounded-2xl sm:aspect-[4/3]" />
  }

  return (
    <div>
      <div
        ref={track}
        onScroll={e => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / el.clientWidth))
        }}
        className="flex aspect-square w-full snap-x sm:aspect-[4/3] snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none]"
      >
        {urls.map((_, i) => (
          <ProductImage key={i} product={product} index={i} sizes="(min-width: 640px) 512px, 100vw" className="h-full w-full shrink-0 snap-center" />
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {urls.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Photo ${i + 1} of ${urls.length}`}
            aria-current={i === index}
            onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })}
            className="flex size-6 items-center justify-center"
          >
            <span className={cx('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-ink' : 'w-1.5 bg-line-strong')} />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Product detail: photos, weight, quantity, add to cart. */
export function ProductSheet({ product, onClose, onAdded }: { product: Product | null; onClose: () => void; onAdded: () => void }) {
  return (
    <Dialog open={!!product} onClose={onClose} title={product?.name ?? 'Product'} hideTitle>
      {product && <ProductSheetBody key={product.id} product={product} onAdded={onAdded} />}
    </Dialog>
  )
}

function ProductSheetBody({ product, onAdded }: { product: Product; onAdded: () => void }) {
  const { add, lines } = useCart()
  const isFlower = product.category === 'Flower'
  const stock = Number(product.stock_grams)
  const inCartGrams = lines
    .filter(l => l.productId === product.id)
    .reduce((s, l) => s + Number(l.weight ?? 0) * l.qty, 0)
  const available = Math.max(0, stock - inCartGrams)

  const weights = WEIGHTS.filter(w => unitPriceFor(product, w) > 0)
  const firstFitting = weights.find(w => Number(w) <= available) ?? weights[0] ?? '3.5'
  const [weight, setWeight] = useState<string>(firstFitting)
  const [qty, setQty] = useState(1)

  const unit = unitPriceFor(product, isFlower ? weight : null)
  const maxQty = isFlower ? Math.max(0, Math.floor(available / Number(weight))) : 10
  const soldOut = isFlower && maxQty < 1
  const deal = dealLabel(product)

  return (
    <div className="flex flex-col gap-5">
      <Gallery product={product} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StrainBadge type={product.strain_type} />
          {product.thc && product.thc !== '—' && <span className="text-sm font-semibold text-muted">THC {product.thc}</span>}
          {product.is_popular && <Badge tone="gold"><Flame size={12} strokeWidth={2} /> Popular</Badge>}
        </div>
        <h2 className="display text-3xl font-semibold leading-tight">{product.name}</h2>
        {product.description && <p className="max-w-prose text-muted">{product.description}</p>}
        {deal && <p className="text-sm font-semibold text-ok">Deal: {deal}, mix and match.</p>}
      </div>

      {isFlower && weights.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Size</p>
          <Segmented
            label="Size"
            value={weight}
            onChange={w => { setWeight(w); setQty(1) }}
            options={weights.map(w => ({
              value: w,
              disabled: Number(w) > available,
              label: (
                <span className="flex flex-col py-1 leading-tight">
                  <span>{WEIGHT_LABELS[w]}</span>
                  <span className="tabular text-xs font-normal opacity-75">{money(unitPriceFor(product, w))}</span>
                </span>
              ),
            }))}
          />
          {inCartGrams > 0 && <p className="text-sm text-muted">{inCartGrams}g already in your cart.</p>}
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-4 border-t border-line bg-canvas px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <QtyStepper label="Quantity" value={qty} max={Math.max(1, maxQty)} onChange={setQty} />
        <Button
          size="lg"
          className="flex-1"
          disabled={soldOut}
          onClick={() => {
            add({
              productId: product.id,
              name: product.name,
              category: product.category,
              weight: isFlower ? weight : null,
              qty,
              image: product.image_urls?.[0] ?? null,
            })
            onAdded()
          }}
        >
          {soldOut ? 'All in your cart' : <>Add to cart <span className="tabular opacity-80">· {money(unit * qty)}</span></>}
        </Button>
      </div>
    </div>
  )
}
