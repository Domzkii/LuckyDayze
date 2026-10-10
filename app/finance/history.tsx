import { BookOpen } from 'lucide-react'
import { formatDay, money } from '@/lib/format'
import { Badge } from '@/components/ui'
import type { FinanceData } from './data'
import { ROLES, formatWeight } from './math'
import { Empty, Row, Rows } from './parts'

const c = { cents: true }

export function History({ data }: { data: FinanceData }) {
  const closed = data.weeks.filter(w => w.status === 'closed')

  if (closed.length === 0) {
    return (
      <Empty icon={<BookOpen size={28} strokeWidth={1.75} />} title="No closed weeks yet">
        Each week shows up here once it’s closed, with its totals and payouts.
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {closed.map(week => {
        const payouts = data.payouts.filter(p => p.week_id === week.id)
        const invested = data.investments.find(i => i.week_id === week.id)
        return (
          <section key={week.id} className="border-t border-line pt-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="display text-xl font-semibold">Week {week.week_number}</h2>
              <span className="text-sm text-muted">
                {formatDay(week.start_date)}{week.end_date ? ` – ${formatDay(week.end_date)}` : ''}
              </span>
            </div>
            <Rows>
              <Row label="Revenue" value={money(Number(week.total_revenue) || 0, c)} tone="gold" strong />
              <Row label="Net profit" value={money(Number(week.total_profit) || 0, c)} strong />
              <Row label="Sold" value={formatWeight(Number(week.total_grams_sold) || 0)} />
              <Row label="Delivery costs" value={money(Number(week.total_delivery_costs) || 0, c)} tone="danger" />
              {invested && <Row label="Invested" value={`+${money(Number(invested.contribution), c)}`} tone="ok" />}
            </Rows>
            <h3 className="mb-1 mt-5 flex items-center gap-2 text-sm font-semibold">
              Payouts {payouts.length === 0 && <Badge>None recorded</Badge>}
            </h3>
            {payouts.length > 0 && (
              <Rows>
                {ROLES.map(role => {
                  const p = payouts.find(x => x.role === role.key)
                  if (!p) return null
                  return (
                    <Row
                      key={role.key}
                      label={role.label}
                      detail={`${money(Number(p.gross_payout), c)} gross − ${money(Number(p.delivery_contribution), c)} delivery`}
                      value={money(Number(p.net_payout), c)}
                      tone="gold"
                    />
                  )
                })}
              </Rows>
            )}
          </section>
        )
      })}
    </div>
  )
}
