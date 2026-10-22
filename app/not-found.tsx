'use client'

import { useState } from 'react'
import { Clover, Dices } from 'lucide-react'
import { SiteFooter, SiteHeader } from '@/components/site'
import { Button, ButtonLink } from '@/components/ui'

// Any address that doesn't exist lands here. Tapping the button rolls a new excuse.
const EXCUSES = [
  'It went out for snacks and never came back.',
  'It got a little too lucky and floated off.',
  'It’s on the couch. It’s not getting up.',
  'It forgot what it came in here for.',
  'It’s somewhere in the building. Probably.',
  'It said “five more minutes” an hour ago.',
  'It’s staring at the ceiling. It looks happy.',
]

export default function NotFound() {
  const [excuse, setExcuse] = useState(0)

  return (
    <>
      <SiteHeader back={{ href: '/', label: 'Menu' }} />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 pb-24 pt-14 text-center sm:px-6 sm:pt-20">
        <div className="flex w-full animate-rise flex-col items-center">
          <p className="display flex items-center gap-1 text-8xl font-semibold leading-none sm:text-9xl" aria-label="404">
            4<Clover className="size-[0.8em] text-gold" strokeWidth={1.5} aria-hidden />4
          </p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">So close to 420</p>
          <div className="my-10 h-px w-16 bg-gold" />
          <h1 className="display text-3xl font-semibold sm:text-4xl">This page isn’t here.</h1>
          <p className="mt-3 min-h-14 text-lg text-muted" aria-live="polite">{EXCUSES[excuse]}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExcuse(i => (i + 1) % EXCUSES.length)}>
            <Dices size={16} strokeWidth={1.75} aria-hidden /> Blame something else
          </Button>
          <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row">
            <ButtonLink href="/" size="lg" className="flex-1">Back to the menu</ButtonLink>
            <ButtonLink href="/track" size="lg" variant="outline" className="flex-1">Track an order</ButtonLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
