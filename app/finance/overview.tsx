import { AlertTriangle } from 'lucide-react'
import { formatDay, money } from '@/lib/format'
import type { FinanceData } from './data'
import { GRAMS_PER_QP, HAND_SELLER, LOW_STOCK_GRAMS, ROLES, formatWeight, roleLabel, sum } from './math'
import { Giveaways } from './giveaways'
import { Meter, Row, Rows, Section } from './parts'

export function Overview({ data }: { data: FinanceData }) {
  const { sales, weeks, payouts, investments, products, settings } = data
  const closedWeeks = weeks.filter(w => w.status === 'closed')
  const orderCount = new Set(sales.flatMap(s => s.order_id ? [s.order_id] : [])).size
  const handSales = sales.filter(s => s.seller)
  const invested = sum(investments, i => i.contribution)
  const strains = products.filter(p => p.category === 'Flower' && !p.archived)
  const costPerGram = Number(settings?.cost_per_gram) || 0
  const c = { cents: true }

  return (
    <div className="flex flex-col gap-10">
      <Section title="All time">
        <Rows>
          <Row label="Revenue" detail="After discounts" value={money(sum(sales, s => s.revenue), c)} strong tone="gold" />
          <Row label="Net profit" detail="After discounts and free items" value={money(sum(sales, s => s.net_profit), c)} strong />
          <Row label="Invested" detail="Its share of profit once the re-up fund is covered" value={money(invested, c)} tone="ok" />
          <Row label="Orders delivered" value={orderCount} />
          {handSales.length > 0 && (
            <Row label={`${HAND_SELLER.label}’s sales`} detail={formatWeight(sum(handSales, s => s.grams_sold))} value={money(sum(handSales, s => s.revenue), c)} />
          )}
          <Row label="Weeks closed" value={closedWeeks.length} />
          {settings && (
            <Row label="Cost basis" value={`${money(costPerGram, c)}/g (${money(costPerGram * GRAMS_PER_QP, { cents: false })} per QP)`} />
          )}
        </Rows>
      </Section>

      <Giveaways sales={sales} title="Rewards and discounts, all time" />

      <Section title="Payouts">
        {payouts.length === 0 ? (
          <p className="text-sm text-muted">Payouts appear here after the first week is closed.</p>
        ) : (
          <Rows>
            {/* Partners first, then anyone paid before the team was two partners. */}
            {[...new Set([...ROLES.map(r => r.key as string), ...payouts.map(p => p.role)])].map(role => {
              const mine = payouts.filter(p => p.role === role)
              if (mine.length === 0) return null
              return <Row key={role} label={roleLabel(role)} value={money(sum(mine, p => p.net_payout), c)} tone="gold" />
            })}
          </Rows>
        )}
      </Section>

      <Section title="Investment fund">
        {investments.length === 0 ? (
          <p className="text-sm text-muted">Nothing invested yet. Contributions start once the re-up fund is covered.</p>
        ) : (
          <Rows>
            {investments.map(entry => (
              <Row
                key={entry.id}
                label={formatDay(entry.created_at.slice(0, 10))}
                detail={`On ${money(Number(entry.week_revenue), c)} revenue · running total ${money(Number(entry.running_total), c)}`}
                value={`+${money(Number(entry.contribution), c)}`}
                tone="ok"
              />
            ))}
            <Row label="Total invested" value={money(invested, c)} strong tone="ok" />
          </Rows>
        )}
      </Section>

      <Section title="Inventory">
        {strains.length === 0 ? (
          <p className="text-sm text-muted">No flower strains yet. Add them in Products.</p>
        ) : (
          <ul className="flex flex-col">
            {strains.map(p => {
              const grams = Number(p.stock_grams) || 0
              const low = grams < LOW_STOCK_GRAMS
              return (
                <li key={p.id} className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-semibold">{p.name}</span>
                    <span className={`tabular flex items-center gap-1.5 ${low ? 'font-semibold text-warn' : 'text-muted'}`}>
                      {low && <AlertTriangle size={14} strokeWidth={1.75} aria-label="Low stock" />}
                      {formatWeight(grams)}
                    </span>
                  </div>
                  <Meter value={(grams / GRAMS_PER_QP) * 100} tone={low ? 'warn' : 'gold'} label={`${p.name} stock, share of one QP`} />
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
