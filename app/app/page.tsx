import type { Metadata } from 'next'
import { InstallGuide } from '@/components/install'
import { SiteFooter, SiteHeader } from '@/components/site'

export const metadata: Metadata = {
  title: 'Get the app — LuckyDayze',
  description: 'Put LuckyDayze on your home screen. No app store needed.',
}

export default function AppPage() {
  return (
    <>
      <SiteHeader back={{ href: '/', label: 'Menu' }} />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <h1 className="display text-4xl font-semibold sm:text-5xl">Get the app</h1>
        <p className="mt-3 text-lg text-muted">
          Put LuckyDayze on your home screen and it opens like any app, full screen and one tap away. No app store, nothing to download.
        </p>
        <div className="mt-10 rounded-3xl border border-line bg-surface p-6">
          <InstallGuide />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
