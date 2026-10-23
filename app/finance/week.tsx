'use client'

import { useState } from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { formatDay, money } from '@/lib/format'
import { Badge, Button, ConfirmDialog, IconButton, Notice, Segmented } from '@/components/ui'
import type { Sale } from '@/lib/types'
import type { FinanceData } from './data'
import { DEFAULT_REUP_GOAL, GRAMS_PER_OZ, HAND_SELLER, SPLIT_PARTS, type Splits, formatWeight, projectWeek, roleLabel, sellerLabel, splitTotal, sum } from './math'
import { Giveaways } from './giveaways'
import { Empty, Meter, Row, Rows, Section } from './parts'

const c = { cents: true }

type SalesFilter = 'all' | 'app' | 'hand'

export function ThisWeek({ data, splits, splitsDirty, splitsSaving, splitsError, onSplitsChange, onSplitsSave, onSplitsReset, onStart, onClose, onLogHandSale, onChanged }: {
  data: FinanceData
  splits: Splits
  splitsDirty: boolean
  splitsSaving: boolean
  splitsError: string | null
  onSplitsChange: (s: Splits) => void
  onSplitsSave: () => void
  onSplitsReset: () => void
  onStart: () => void
  onClose: () => void
  onLogHandSale: () => void
  onChanged: () => Promise<void>
}) {
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('all')
  const [removing, setRemoving] = useState<Sale | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const activeWeek = data.weeks.find(w => w.status === 'active')
  const weekSales = activeWeek ? data.sales.filter(s => s.week_id === activeWeek.id) : []
  const p = projectWeek(weekSales, data.reupFund, splits)
  const fund = data.reupFund
  const total = splitTotal(splits)
  const soldRows = weekSales.filter(s => (s.kind ?? 'sale') === 'sale')
  const handRows = soldRows.filter(s => s.seller)
  const shownRows = salesFilter === 'all' ? soldRows : soldRows.filter(s => (salesFilter === 'hand') === !!s.seller)

  async function removeHandSale() {
    if (!removing) return
    setRemoveBusy(true)
    setRemoveError(null)
    const { error } = await supabase().rpc('remove_hand_sale', { p_sale_id: removing.id })
    if (error) {
      setRemoveBusy(false)
      return setRemoveError(`Couldn’t remove it: ${error.message}`)
    }
    await onChanged()
    setRemoveBusy(false)
    setRemoving(null)
  }

  return (
    <div className="flex flex-col gap-10">
      {!activeWeek ? (
        <Empty icon={<CalendarPlus size={28} strokeWidth={1.75} />} title="No week in progress">
          <p className="mb-5">Start a week to restock strains, set the re-up goal and begin tracking sales and payouts.</p>
          <Button onClick={onStart}>Start a week</Button>
        </Empty>
      ) : (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="display text-3xl font-semibold">Week {activeWeek.week_number}</h2>
              <p className="mt-1 text-sm text-muted">Started {formatDay(activeWeek.start_date)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onLogHandSale}>Log {HAND_SELLER.label}’s sale</Button>
              <Button variant="gold" onClick={onClose}>Close week</Button>
            </div>
          </div>
          <Rows>
            <Row label="Revenue" value={money(p.revenue, c)} strong tone="gold" />
            <Row label="Profit" value={money(p.profit, c)} strong />
            <Row label="Sold" value={formatWeight(p.grams)} />
            {handRows.length > 0 && (
              <Row
                label={`${HAND_SELLER.label}’s sales`}
                detail={`Included above · ${formatWeight(sum(handRows, s => s.grams_sold))}`}
                value={money(sum(handRows, s => s.revenue), c)}
              />
            )}
            {p.delivery > 0 && <Row label="Delivery costs" value={money(p.delivery, c)} tone="danger" />}
          </Rows>
        </section>
      )}

      <Section title="Re-up fund">
        {!fund ? (
          <p className="text-sm text-muted">No re-up fund yet. One is created when you start a week.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="display tabular text-2xl font-semibold text-gold-ink">{money(Number(fund.current_balance), c)}</span>
              <span className="tabular text-sm text-muted">of {money(Number(fund.goal) || DEFAULT_REUP_GOAL)} goal</span>
            </div>
            <Meter value={(Number(fund.current_balance) / (Number(fund.goal) || DEFAULT_REUP_GOAL)) * 100} label="Re-up fund progress" />
            {fund.status === 'completed' ? (
              <Notice tone="ok">Goal met. Start the next week to set a new goal.</Notice>
            ) : (
              <p className="tabular text-sm text-muted">{money(p.reupNeeded, c)} still needed. All profit goes here first; Hussein and Dominic are paid once it is covered.</p>
            )}
          </div>
        )}
      </Section>

      {activeWeek && (
        <Section title="Where this week’s profit goes">
          <Rows>
            {p.fundOpen && <Row label="Re-up fund" value={money(p.toReup, c)} tone="gold" />}
            <Row label="Left to split" detail="Profit after the re-up fund" value={money(p.surplus, c)} strong />
          </Rows>
          <h3 className="mb-1 mt-6 text-sm font-semibold">Projected payouts</h3>
          <Rows>
            {p.payouts.map(row => (
              <Row key={row.role} label={roleLabel(row.role)} detail={`${splits[row.role]}%`} value={money(row.amount, c)} tone="gold" />
            ))}
            <Row label="Investment fund" detail={`${splits.investment}%`} value={money(p.investment, c)} tone="ok" />
          </Rows>
        </Section>
      )}

      {activeWeek && (
        <Section
          title="Profit split"
          action={<Badge tone={total === 100 ? 'ok' : 'danger'}>{total}%{total === 100 ? '' : ', should be 100%'}</Badge>}
        >
          <p className="mb-4 text-sm text-muted">How profit is split once the re-up fund is covered. Saved for both of you and used when the week closes.</p>
          <div className="flex flex-col gap-4">
            {SPLIT_PARTS.map(part => (
              <label key={part.key} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{part.label}</span>
                  <span className="tabular font-semibold text-gold-ink">{splits[part.key]}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splits[part.key]}
                  onChange={e => onSplitsChange({ ...splits, [part.key]: Number(e.target.value) })}
                  className="h-11 w-full cursor-pointer accent-gold"
                />
              </label>
            ))}
          </div>
          {splitsError && <Notice tone="danger" className="mt-4">{splitsError}</Notice>}
          {splitsDirty && (
            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onSplitsReset}>Undo</Button>
              <Button className="flex-1" onClick={onSplitsSave} loading={splitsSaving} disabled={total !== 100}>Save split</Button>
            </div>
          )}
        </Section>
      )}

      {activeWeek && <Giveaways sales={weekSales} title="Rewards and discounts this week" />}

      {activeWeek && (
        <Section title="Sales this week">
          {handRows.length > 0 && (
            <Segmented
              label="Show sales from"
              size="sm"
              value={salesFilter}
              onChange={setSalesFilter}
              className="mb-3"
              options={[
                { value: 'all', label: 'All' },
                { value: 'app', label: 'App' },
                { value: 'hand', label: HAND_SELLER.label },
              ]}
            />
          )}
          {salesFilter !== 'all' && shownRows.length > 0 && (
            <p className="tabular mb-1 text-sm text-muted">
              {money(sum(shownRows, s => s.revenue), c)} · {formatWeight(sum(shownRows, s => s.grams_sold))} · {money(sum(shownRows, s => s.net_profit), c)} profit
            </p>
          )}
          {shownRows.length === 0 ? (
            <p className="text-sm text-muted">No sales booked this week yet.</p>
          ) : (
            <ul className="flex flex-col">
              {shownRows.map(sale => (
                <li key={sale.id} className="border-b border-line py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">{sale.product_name}</p>
                      <p className="tabular text-xs text-muted">
                        {sale.seller && `${sellerLabel(sale.seller)} · `}
                        {(Number(sale.grams_sold) / GRAMS_PER_OZ).toFixed(2)} oz ({Number(sale.grams_sold)} g) · {formatDay(sale.created_at.slice(0, 10))}
                        {Number(sale.delivery_cost) > 0 && ` · ${money(Number(sale.delivery_cost), c)} delivery`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="tabular text-right">
                        <p className="font-semibold">{money(Number(sale.revenue), c)}</p>
                        <p className="text-xs text-ok">+{money(Number(sale.net_profit), c)} profit</p>
                      </div>
                      {sale.seller && (
                        <IconButton label={`Remove ${sale.product_name} sale`} onClick={() => { setRemoveError(null); setRemoving(sale) }}>
                          <Trash2 size={16} strokeWidth={1.75} />
                        </IconButton>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={removeHandSale}
        loading={removeBusy}
        tone="danger"
        title="Remove this sale?"
        confirmLabel="Remove sale"
        body={removing && (
          <>
            <p>{removing.product_name}, {Number(removing.grams_sold)} g for {money(Number(removing.revenue), c)}. The weight goes back into stock.</p>
            {removeError && <Notice tone="danger" className="mt-3">{removeError}</Notice>}
          </>
        )}
      />
    </div>
  )
}
