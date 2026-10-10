'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, Clock, DoorOpen, RefreshCw, Tag } from 'lucide-react'
import { InstagramIcon } from '@/components/icons'
import { INSTAGRAM, money } from '@/lib/format'
import { PERKS, quote } from '@/lib/pricing'
import { availableProducts, useCatalog } from '@/lib/use-catalog'
import type { Product, SaleEvent } from '@/lib/types'
import { useCart } from '@/components/cart'
import { CartDrawer } from '@/components/cart-drawer'
import { ProductCard, ProductSheet } from '@/components/product'
import { AgeGate, SiteFooter, SiteHeader } from '@/components/site'
import { Button, ButtonLink, Spinner, cx } from '@/components/ui'

const LINES = [
  'The plug is in.',
  'NYC’s finest, at your door.',
  'Top shelf, every time.',
  'Fresh drops. Fast delivery.',
  'Rolled with love. Delivered with speed.',
  'We don’t do mid. Ever.',
  'From the boroughs with love.',
  'Your couch is waiting.',
  'Life is short. Smoke good.',
  'Good flower. Good people. Good times.',
]

export default function Home() {
  return (
    <AgeGate>
      <Storefront />
    </AgeGate>
  )
}

function Storefront() {
  const { products, settings, sale, status, reload } = useCatalog()
  const { lines, count } = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const [line] = useState(() => LINES[Math.floor(Math.random() * LINES.length)])

  // "Edit" from checkout lands on /?cart=1 with the cart open.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('cart') !== '1') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opening from a URL flag after mount
    setCartOpen(true)
    url.searchParams.delete('cart')
    window.history.replaceState(null, '', url)
  }, [])

  const open = settings?.is_open ?? true
  const { flower, preRolls } = availableProducts(products)
  const cartTotal = quote(lines, products, { sale, tier: null, scheduledAhead: false }).total

  return (
    <>
      <SiteHeader onCart={() => setCartOpen(true)} />

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-20">
          <h1 className="display max-w-3xl text-[44px] font-semibold leading-[1.02] sm:text-7xl">
            Premium cannabis, <em className="font-medium text-gold-ink">delivered right.</em>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">
            {line} Flower and pre-rolls, brought right to your door.
          </p>
          <StoreStatus open={open} loading={status === 'loading'} />
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#menu" className="inline-flex min-h-14 items-center gap-2 rounded-full bg-ink px-7 font-semibold text-canvas transition-colors hover:bg-ink/85">
              Shop the menu <ArrowDown size={18} strokeWidth={1.75} />
            </a>
            <ButtonLink href="/rewards" variant="outline" size="lg">Lucky Rewards</ButtonLink>
          </div>
        </section>

        {sale && <SaleBand sale={sale} />}
        <PerksBand />

        <section id="menu" aria-labelledby="menu-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 pt-10 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
            <h2 id="menu-title" className="display text-3xl font-semibold sm:text-4xl">The menu</h2>
            {status === 'ready' && flower.length + preRolls.length > 0 && (
              <nav aria-label="Menu sections" className="flex gap-1 text-sm font-semibold">
                {flower.length > 0 && <a href="#flower" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">Flower</a>}
                {preRolls.length > 0 && <a href="#pre-rolls" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">Pre-rolls</a>}
              </nav>
            )}
          </div>

          {status === 'loading' && <Spinner label="Loading the menu" />}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="display text-2xl font-semibold">We couldn’t load the menu.</p>
              <p className="text-muted">Check your connection and try again.</p>
              <Button variant="outline" onClick={reload}><RefreshCw size={16} strokeWidth={1.75} /> Try again</Button>
            </div>
          )}

          {status === 'ready' && flower.length + preRolls.length === 0 && <EmptyMenu open={open} />}

          {flower.length > 0 && (
            <MenuSection id="flower" title="Flower" note={`${flower.length} strain${flower.length === 1 ? '' : 's'}`}>
              {flower.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 2} onOpen={() => setSelected(p)} />)}
            </MenuSection>
          )}

          {preRolls.length > 0 && (
            <MenuSection id="pre-rolls" title="Pre-rolls" note="$10 each, any 2 for $15">
              {preRolls.map(p => <ProductCard key={p.id} product={p} onOpen={() => setSelected(p)} />)}
            </MenuSection>
          )}
        </section>
      </main>

      <SiteFooter />

      {count > 0 && (
        <div className="pointer-events-none sticky bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:px-6">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="pointer-events-auto mx-auto flex min-h-14 w-full max-w-md animate-rise items-center justify-between gap-4 rounded-full bg-ink px-6 text-canvas shadow-lift transition-colors hover:bg-ink/90"
          >
            <span className="font-semibold">View cart</span>
            <span className="tabular text-sm opacity-80">{count} item{count === 1 ? '' : 's'} · {money(cartTotal, { cents: true })}</span>
          </button>
        </div>
      )}

      <ProductSheet product={selected} onClose={() => setSelected(null)} onAdded={() => setSelected(null)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} products={products} sale={sale} settings={settings} />
    </>
  )
}

function StoreStatus({ open, loading }: { open: boolean; loading: boolean }) {
  if (loading) return <div className="mt-6 h-6" />
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
      <span className="inline-flex items-center gap-2">
        <span className={cx('size-2 rounded-full', open ? 'bg-ok' : 'bg-warn')} aria-hidden />
        {open ? 'Delivering now' : 'Delivery is closed right now'}
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted">
        {open ? <DoorOpen size={15} strokeWidth={1.75} /> : <Clock size={15} strokeWidth={1.75} />}
        {open ? 'Right to your door' : 'Pickup and scheduled delivery are open'}
      </span>
    </p>
  )
}

function PerksBand() {
  const perks = [
    { at: PERKS.choiceMin, get: `${PERKS.freePreRolls} free pre-rolls, or $${PERKS.credit} off your next order` },
    { at: PERKS.eighthMin, get: 'a free 1/8 of your choice' },
  ]
  return (
    <div className="border-y border-line bg-surface">
      <dl className="mx-auto flex max-w-6xl flex-col gap-x-10 gap-y-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:px-6">
        {perks.map(p => (
          <div key={p.at} className="flex gap-2">
            <dt className="tabular shrink-0 font-semibold text-gold-ink">Spend {money(p.at)}</dt>
            <dd>{p.get}</dd>
          </div>
        ))}
        <div className="text-muted sm:ml-auto">One deal per order, always your best one.</div>
      </dl>
    </div>
  )
}

function SaleBand({ sale }: { sale: SaleEvent }) {
  const amount = sale.discount_type === 'percent' ? `${Number(sale.discount_value)}% off` : `${money(Number(sale.discount_value))} off`
  const scope = sale.applies_to === 'flower' ? 'all flower' : sale.applies_to === 'prerolls' ? 'all pre-rolls' : 'your whole order'
  return (
    <div className="bg-gold text-on-gold">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:px-6">
        <Tag size={18} strokeWidth={1.75} className="shrink-0" />
        <p className="text-sm sm:text-base">
          <span className="font-semibold">{sale.title}.</span> {amount} {scope}, taken off at checkout.
        </p>
      </div>
    </div>
  )
}

function MenuSection({ id, title, note, children }: { id: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mb-14 scroll-mt-24 last:mb-0">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h3 id={`${id}-title`} className="display text-2xl font-semibold">{title}</h3>
        <span className="text-sm text-muted">{note}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{children}</div>
    </section>
  )
}

function EmptyMenu({ open }: { open: boolean }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="display text-3xl font-semibold">{open ? 'Restocking now.' : 'We’re closed right now.'}</p>
      <p className="mt-3 max-w-sm text-muted">
        {open ? 'The next drop is on its way. ' : 'The plug is resting. '}
        Follow us for restock news, and check your points while you wait.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href={`https://instagram.com/${INSTAGRAM}`} external>
          <InstagramIcon /> @{INSTAGRAM}
        </ButtonLink>
        <Link href="/rewards" className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 font-semibold hover:border-ink">Check your rewards</Link>
      </div>
    </div>
  )
}
