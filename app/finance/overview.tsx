import { AlertTriangle } from 'lucide-react'
import { formatDay, money } from '@/lib/format'
import type { FinanceData } from './data'
import { GRAMS_PER_QP, LOW_STOCK_GRAMS, ROLES, formatWeight, sum } from './math'
import { Giveaways } from './giveaways'
import { Meter, Row, Rows, Section } from './parts'

export function Overview({ data }: { data: FinanceData }) {
  const { sales, weeks, payouts, investments, products, settings } = data
  const closedWeeks = weeks.filter(w => w.status === 'closed')
  const orderCount = new Set(sales.map(s => s.order_id)).size
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
          <Row label="Invested" detail="5% of revenue once the re-up fund is covered" value={money(invested, c)} tone="ok" />
          <Row label="Orders delivered" value={orderCount} />
          <Row label="Weeks closed" value={closedWeeks.length} />
          {settings && (
            <Row label="Cost basis" value={`${money(costPerGram, c)}/g (${money(costPerGram * GRAMS_PER_QP, { cents: false })} per QP)`} />
          )}
        </Rows>
      </Section>

      <Giveaways sales={sales} title="Rewards and discounts, all time" />

      <Section title="Payouts by role">
        {payouts.length === 0 ? (
          <p className="text-sm text-muted">Payouts appear here after the first week is closed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Role</th>
                  <th scope="col" className="py-2 px-3 text-right font-medium">Gross</th>
                  <th scope="col" className="py-2 px-3 text-right font-medium">Delivery</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map(role => {
                  const mine = payouts.filter(p => p.role === role.key)
                  const gross = sum(mine, p => p.gross_payout)
                  const delivery = sum(mine, p => p.delivery_contribution)
                  return (
                    <tr key={role.key} className="border-b border-line last:border-b-0">
                      <th scope="row" className="py-3 pr-3 text-left font-semibold">
                        {role.label}
                        <span className="block text-xs font-normal text-muted">{role.desc}</span>
                      </th>
                      <td className="tabular py-3 px-3 text-right">{money(gross, c)}</td>
                      <td className="tabular py-3 px-3 text-right text-danger">−{money(delivery, c)}</td>
                      <td className="tabular py-3 pl-3 text-right font-semibold text-gold-ink">{money(gross - delivery, c)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
