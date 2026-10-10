'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/browser'
import { money, todayInStore } from '@/lib/format'
import { Button, Dialog, Field, Notice, inputClass } from '@/components/ui'
import { type FinanceData, runWrites } from './data'
import { DEFAULT_REUP_GOAL, GRAMS_PER_OZ, GRAMS_PER_QP, type Splits, carryoverFrom, closingBook, formatWeight, projectWeek, roleLabel, round2 } from './math'
import { Row, Rows } from './parts'

const c = { cents: true }

// ─── Start week ──────────────────────────────────────────────────────────────

export function StartWeekDialog({ open, onClose, data, onDone }: {
  open: boolean; onClose: () => void; data: FinanceData; onDone: () => Promise<void>
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Start a new week">
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {open && <StartWeekForm data={data} onClose={onClose} onDone={onDone} />}
    </Dialog>
  )
}

function StartWeekForm({ data, onClose, onDone }: { data: FinanceData; onClose: () => void; onDone: () => Promise<void> }) {
  const strains = data.products.filter(p => p.category === 'Flower' && !p.archived)
  const closed = data.weeks.filter(w => w.status === 'closed')
  const carryover = carryoverFrom(closed[0])
  const [ounces, setOunces] = useState<Record<string, string>>({})
  const [goal, setGoal] = useState(String(data.reupFund?.goal ?? DEFAULT_REUP_GOAL))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gramsFor = (id: string) => Math.max(0, Number(ounces[id]) || 0) * GRAMS_PER_OZ
  const totalGrams = strains.reduce((s, p) => s + gramsFor(p.id), 0)
  const goalValue = Number(goal)
  const goalError = !(goalValue > 0) ? 'Enter a goal above $0.' : null

  async function start() {
    if (goalError) return
    setBusy(true)
    setError(null)
    const db = supabase()
    const { data: week, error: weekError } = await db
      .from('weeks')
      .insert({
        week_number: data.weeks.length + 1,
        start_date: todayInStore(),
        carried_over_grams: round2(carryover),
        new_grams_added: round2(totalGrams),
        status: 'active',
      })
      .select()
      .single()
    if (weekError || !week) {
      setBusy(false)
      setError(weekError?.message ?? 'Couldn’t create the week.')
      return
    }
    const fund = data.reupFund
    const message = await runWrites([
      ...strains.map(p => () => db.from('products').update({ stock_grams: round2(gramsFor(p.id)), in_stock: gramsFor(p.id) > 0 }).eq('id', p.id)),
      () => db.from('products').update({ in_stock: true }).eq('category', 'Pre-Rolls'),
      fund
        ? () => db.from('reup_fund').update({ goal: goalValue, current_balance: 0, status: 'active', week_id: week.id }).eq('id', fund.id)
        : () => db.from('reup_fund').insert({ goal: goalValue, current_balance: 0, status: 'active', week_id: week.id }),
    ])
    setBusy(false)
    if (message) return setError(`The week started, but a follow-up update failed: ${message}`)
    await onDone()
    onClose()
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Set this week’s stock for each strain and the re-up goal. Stock you enter replaces what’s on hand.
        {carryover > 0 && <> Last week left about <span className="tabular font-semibold text-ink">{formatWeight(carryover)}</span>.</>}
      </p>

      <Field label="Re-up goal" hint={`All profit goes here first. ${(goalValue / 400 || 0).toFixed(1)} QPs at $400 each.`} error={goalError}>
        {props => (
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input {...props} type="number" inputMode="decimal" min={0} value={goal} onChange={e => setGoal(e.target.value)} className={`${inputClass} tabular pl-8`} />
          </div>
        )}
      </Field>

      <div className="flex flex-col">
        <h3 className="mb-1 text-sm font-semibold">Stock per strain</h3>
        {strains.length === 0 ? (
          <p className="text-sm text-muted">No active flower strains. Add them in Products first.</p>
        ) : (
          strains.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="tabular text-xs text-muted">
                  {gramsFor(p.id) > 0 ? `${gramsFor(p.id).toFixed(1)} g · ${(gramsFor(p.id) / GRAMS_PER_QP).toFixed(2)} QP` : `On hand: ${formatWeight(Number(p.stock_grams) || 0)}`}
                </p>
              </div>
              <label className="relative w-28 shrink-0">
                <span className="sr-only">{p.name} stock in ounces</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  placeholder="0"
                  value={ounces[p.id] ?? ''}
                  onChange={e => setOunces(prev => ({ ...prev, [p.id]: e.target.value }))}
                  className={`${inputClass} tabular pr-10 text-right`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">oz</span>
              </label>
            </div>
          ))
        )}
        {strains.length > 0 && (
          <div className="flex items-baseline justify-between pt-3 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular text-gold-ink">{formatWeight(totalGrams)} · {(totalGrams / GRAMS_PER_QP).toFixed(2)} QP</span>
          </div>
        )}
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={start} loading={busy} disabled={!!goalError}>Start week</Button>
      </div>
    </div>
  )
}

// ─── Close week ──────────────────────────────────────────────────────────────

export function CloseWeekDialog({ open, onClose, data, splits, onDone }: {
  open: boolean; onClose: () => void; data: FinanceData; splits: Splits; onDone: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeWeek = data.weeks.find(w => w.status === 'active')
  const weekSales = activeWeek ? data.sales.filter(s => s.week_id === activeWeek.id) : []
  const preview = projectWeek(weekSales, data.reupFund, splits)
  // Payout lines come from the same book the close writes, so what you see is what gets recorded.
  const book = closingBook(weekSales, data.reupFund, splits)
  const splitTotal = Object.values(splits).reduce((a, b) => a + b, 0)

  async function close() {
    if (!activeWeek) return
    setBusy(true)
    setError(null)
    const db = supabase()
    const fund = data.reupFund
    const runningTotal = data.investments.reduce((s, i) => s + (Number(i.contribution) || 0), 0)

    const message = await runWrites([
      ...(fund && book.fundBalance !== null
        ? [() => db.from('reup_fund').update({ current_balance: round2(book.fundBalance!), status: book.fundCompleted ? 'completed' : 'active' }).eq('id', fund.id)]
        : []),
      ...(book.investment > 0
        ? [() => db.from('investment_fund').insert({
            week_id: activeWeek.id,
            contribution: round2(book.investment),
            running_total: round2(runningTotal + book.investment),
            week_revenue: round2(book.totals.revenue),
          })]
        : []),
      () => db.from('weeks').update({
        end_date: todayInStore(),
        total_revenue: round2(book.totals.revenue),
        total_profit: round2(book.totals.profit),
        total_delivery_costs: round2(book.totals.delivery),
        total_grams_sold: round2(book.totals.grams),
        status: 'closed',
      }).eq('id', activeWeek.id),
      () => db.from('week_payouts').insert(book.payouts.map(p => ({
        week_id: activeWeek.id,
        role: p.role,
        gross_payout: round2(p.gross_payout),
        delivery_contribution: round2(p.delivery_contribution),
        net_payout: round2(p.net_payout),
      }))),
    ])
    setBusy(false)
    if (message) return setError(`Closing stopped partway: ${message}. Check History before trying again.`)
    await onDone()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={activeWeek ? `Close week ${activeWeek.week_number}?` : 'Close week'}>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted">This records the week’s totals and pays out by role. It can’t be undone.</p>
        <Rows>
          <Row label="Revenue" value={money(preview.revenue, c)} />
          <Row label="Profit" value={money(preview.profit, c)} />
          {preview.fundOpen && <Row label="To the re-up fund" value={money(preview.toReup, c)} tone="gold" />}
          {preview.investment > 0 && <Row label="To the investment fund (5%)" value={money(preview.investment, c)} tone="ok" />}
        </Rows>
        {preview.fundOpen && preview.teamSurplus === 0 && (
          <Notice tone="warn">All profit goes to the re-up fund this week. {money(preview.reupNeeded - preview.toReup, c)} still needed after this.</Notice>
        )}
        <div>
          <h3 className="mb-1 text-sm font-semibold">Payouts</h3>
          <Rows>
            {book.payouts.map(p => (
              <Row key={p.role} label={roleLabel(p.role)} value={money(p.net_payout, c)} tone="gold" />
            ))}
            <Row label="Total paid out" value={money(book.payouts.reduce((s, p) => s + p.net_payout, 0), c)} strong />
          </Rows>
        </div>
        {splitTotal !== 100 && <Notice tone="danger">The profit split adds up to {splitTotal}%, not 100%. Fix it in This week before closing.</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={close} loading={busy} disabled={!activeWeek || splitTotal !== 100}>Close and pay out</Button>
        </div>
      </div>
    </Dialog>
  )
}
