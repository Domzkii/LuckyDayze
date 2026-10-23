'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { LogOut, Menu, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { StaffGate } from '@/components/staff-gate'
import { ThemeToggle } from '@/components/theme'
import { IconButton, Notice, Spinner, Wordmark, buttonClass, cx } from '@/components/ui'
import { useFinanceData } from './data'
import { type Splits, readSplits, splitTotal } from './math'
import { Overview } from './overview'
import { ThisWeek } from './week'
import { CloseWeekDialog, StartWeekDialog } from './week-dialogs'
import { History } from './history'
import { HandSaleDialog } from './hand-sale'
import { Products } from './products'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'week', label: 'This week' },
  { key: 'history', label: 'History' },
  { key: 'products', label: 'Products' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function FinancePage() {
  return <StaffGate area="Finance">{() => <Finance />}</StaffGate>
}

function Finance() {
  const { data, loading, error, reload } = useFinanceData()
  const [tab, setTab] = useState<TabKey>('overview')
  // The saved split comes from the database; edits stay a draft until Save split.
  const savedSplits = readSplits(data.settings?.payout_splits)
  const [draftSplits, setDraftSplits] = useState<Splits | null>(null)
  const splits = draftSplits ?? savedSplits
  const [splitsSaving, setSplitsSaving] = useState(false)
  const [splitsError, setSplitsError] = useState<string | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [handOpen, setHandOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  async function saveSplits() {
    if (!draftSplits || splitTotal(draftSplits) !== 100) return
    setSplitsSaving(true)
    setSplitsError(null)
    const { error } = await supabase().from('store_settings').update({ payout_splits: draftSplits }).eq('id', 1)
    if (error) {
      setSplitsSaving(false)
      return setSplitsError(`Couldn’t save the split: ${error.message}`)
    }
    await reload()
    setDraftSplits(null)
    setSplitsSaving(false)
  }

  async function refresh() {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    setTab(TABS[next].key)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark sub="Finance" />
          <nav aria-label="Staff" className="flex items-center gap-1">
            <span className="hidden items-center gap-1 sm:flex">
              <Link href="/admin" className={buttonClass('primary', 'sm')}>Admin</Link>
              <Link href="/" className={buttonClass('ghost', 'sm')}>Storefront</Link>
            </span>
            <IconButton label="Refresh" onClick={refresh} disabled={refreshing}>
              <RefreshCw size={18} strokeWidth={1.75} className={refreshing ? 'animate-spin' : ''} />
            </IconButton>
            <ThemeToggle />
            <span className="hidden sm:flex">
              <IconButton label="Sign out" onClick={() => supabase().auth.signOut()}>
                <LogOut size={18} strokeWidth={1.75} />
              </IconButton>
            </span>
            <details className="relative sm:hidden">
              <summary aria-label="More" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink [&::-webkit-details-marker]:hidden">
                <Menu size={20} strokeWidth={1.75} />
              </summary>
              <div className="absolute right-0 top-12 z-40 flex w-48 flex-col rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
                <Link href="/admin" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-sunken">Admin</Link>
                <Link href="/" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-sunken">Storefront</Link>
                <button type="button" onClick={() => supabase().auth.signOut()} className="flex min-h-11 items-center rounded-xl px-3 text-left text-sm font-semibold text-danger hover:bg-danger-tint">Sign out</button>
              </div>
            </details>
          </nav>
        </div>
        <div role="tablist" aria-label="Finance sections" className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              ref={el => { tabRefs.current[i] = el }}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={e => onTabKey(e, i)}
              className={cx(
                'min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors',
                tab === t.key ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6"
      >
        {error && <Notice tone="danger" className="mb-6">{error}</Notice>}
        {loading ? (
          <Spinner label="Loading finance" />
        ) : tab === 'overview' ? (
          <Overview data={data} />
        ) : tab === 'week' ? (
          <ThisWeek
            data={data}
            splits={splits}
            splitsDirty={draftSplits !== null}
            splitsSaving={splitsSaving}
            splitsError={splitsError}
            onSplitsChange={setDraftSplits}
            onSplitsSave={saveSplits}
            onSplitsReset={() => { setDraftSplits(null); setSplitsError(null) }}
            onStart={() => setStartOpen(true)}
            onClose={() => setCloseOpen(true)}
            onLogHandSale={() => setHandOpen(true)}
            onChanged={reload}
          />
        ) : tab === 'history' ? (
          <History data={data} />
        ) : (
          <Products products={data.products} onChanged={reload} />
        )}
      </main>

      <HandSaleDialog open={handOpen} onClose={() => setHandOpen(false)} products={data.products} onDone={reload} />
      <StartWeekDialog open={startOpen} onClose={() => setStartOpen(false)} data={data} onDone={reload} />
      <CloseWeekDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        data={data}
        splits={savedSplits}
        onDone={async () => { await reload(); setStartOpen(true) }}
      />
    </div>
  )
}
