'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, UserRound } from 'lucide-react'
import { InstagramIcon } from './icons'
import { INSTAGRAM } from '@/lib/format'
import { ageVerified, confirmAge } from '@/lib/local'
import { useCart } from './cart'
import { ThemeToggle } from './theme'
import { Button, Wordmark, cx } from './ui'

export function SiteHeader({ onCart, back }: { onCart?: () => void; back?: { href: string; label: string } }) {
  const { count } = useCart()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:h-[72px] sm:px-6">
        {back ? (
          <Link href={back.href} className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft size={18} strokeWidth={1.75} />
            {back.label}
          </Link>
        ) : (
          <Link href="/" aria-label="LuckyDayze home" className="mr-auto">
            <span className="sm:hidden"><Wordmark sub={null} /></span>
            <span className="hidden sm:block"><Wordmark /></span>
          </Link>
        )}
        {back && <Link href="/" aria-label="LuckyDayze home" className="mx-auto hidden sm:block"><Wordmark sub={null} /></Link>}
        <nav aria-label="Main" className={cx('flex items-center', back && 'ml-auto sm:ml-0')}>
          <Link href="/track" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted hover:text-ink sm:inline-flex">
            Track order
          </Link>
          <Link href="/rewards" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-gold-ink hover:text-ink">
            Rewards
          </Link>
          <Link href="/account" aria-label="Your account" className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink">
            <UserRound size={20} strokeWidth={1.75} />
          </Link>
          <ThemeToggle />
          {onCart && (
            <button
              type="button"
              onClick={onCart}
              data-cart-button
              aria-label={count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
              className="relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sunken"
            >
              <ShoppingBag size={20} strokeWidth={1.75} />
              {count > 0 && (
                <span className="tabular absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold leading-5 text-on-gold">
                  {count}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="max-w-sm text-sm text-muted">For adults 21 and over. Please enjoy responsibly, and never drive high.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-1 gap-y-1 text-sm font-semibold">
          <Link href="/track" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">Track an order</Link>
          <Link href="/rewards" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">Lucky Rewards</Link>
          <Link href="/app" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">Get the app</Link>
          <a href={`https://instagram.com/${INSTAGRAM}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-muted hover:text-ink">
            <InstagramIcon size={16} /> @{INSTAGRAM}
          </a>
          <Link href="/admin" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">Back office</Link>
        </nav>
      </div>
    </footer>
  )
}

/**
 * 21+ gate. Remembered for 30 days on this device. Renders nothing until it knows,
 * so returning visitors never see it flash.
 */
export function AgeGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'unknown' | 'ok' | 'ask' | 'under'>('unknown')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after mount
    setState(ageVerified() ? 'ok' : 'ask')
  }, [])

  if (state === 'ok') return <>{children}</>
  if (state === 'unknown') return <main className="min-h-dvh" />

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="flex max-w-sm animate-rise flex-col items-center">
        <Wordmark size="lg" />
        <div className="my-12 h-px w-16 bg-gold" />
        {state === 'under' ? (
          <>
            <h1 className="display text-3xl font-semibold">Come back on your 21st.</h1>
            <p className="mt-3 text-muted">You need to be 21 or older to shop with us.</p>
          </>
        ) : (
          <>
            <h1 className="display text-3xl font-semibold sm:text-4xl">Are you 21 or older?</h1>
            <p className="mt-3 text-muted">You must be of legal age to buy cannabis in New York.</p>
            <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row">
              <Button size="lg" className="flex-1" onClick={() => { confirmAge(); setState('ok') }}>Yes, I’m 21+</Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={() => setState('under')}>No</Button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
