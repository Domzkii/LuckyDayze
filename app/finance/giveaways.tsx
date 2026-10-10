import { money } from '@/lib/format'
import type { Sale } from '@/lib/types'
import { sum } from './math'
import { Row, Rows, Section } from './parts'

const REWARD_LABELS: Record<string, { label: string; detail: string }> = {
  perk_prerolls: { label: 'Spend $60: free pre-rolls', detail: 'Flower cost of the 2 pre-rolls' },
  perk_eighth: { label: 'Spend $150: free 1/8', detail: 'Flower cost of the eighth' },
  free_preroll: { label: 'Points: free pre-roll', detail: '100 points redeemed' },
  free_eighth: { label: 'Points: free eighth', detail: '300 points redeemed' },
  referral_preroll: { label: 'Referral gift', detail: 'Pre-roll for a referred friend' },
}

const DISCOUNT_LABELS: Record<string, { label: string; detail: string }> = {
  preroll_deal: { label: 'Pre-roll 2 for $15', detail: 'Off the $10-each price' },
  credit: { label: 'Spend $60: $7 off next order', detail: 'Used on a later order' },
  house: { label: 'House: 10% off', detail: 'Members on orders of $50+' },
  promo: { label: 'Promos', detail: 'Sales you ran from admin' },
  scheduled: { label: 'Scheduled: 5% off', detail: 'Booked a day ahead' },
}

function group(rows: Sale[], amount: (s: Sale) => number) {
  const map = new Map<string, { total: number; count: number }>()
  for (const s of rows) {
    const key = s.reward_type || 'other'
    const g = map.get(key) ?? { total: 0, count: 0 }
    g.total += amount(s)
    g.count += 1
    map.set(key, g)
  }
  return [...map.entries()].sort((a, b) => b[1].total - a[1].total)
}

/**
 * What rewards and discounts cost: free items at flower cost, discounts at face value.
 * Everything here is already subtracted from revenue and profit elsewhere on the page.
 */
export function Giveaways({ sales, title = 'Rewards and discounts' }: { sales: Sale[]; title?: string }) {
  const c = { cents: true }
  const sold = sales.filter(s => (s.kind ?? 'sale') === 'sale')
  const rewards = sales.filter(s => s.kind === 'reward')
  const discounts = sales.filter(s => s.kind === 'discount')
  const gross = sum(sold, s => s.revenue)
  const grossProfit = sum(sold, s => s.net_profit)
  const rewardCost = sum(rewards, s => s.inventory_cost)
  const discountCost = -sum(discounts, s => s.revenue)
  const given = rewardCost + discountCost
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—')

  return (
    <Section title={title}>
      {rewards.length + discounts.length === 0 ? (
        <p className="text-sm text-muted">Nothing given away yet. Free items and discounts show up here once those orders are delivered.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Rows>
            <Row label="Total given away" strong tone="danger" value={`−${money(given, c)}`}
              detail={`${pct(given, gross)} of sales, ${pct(given, grossProfit)} of the profit before rewards`} />
            <Row label="Sales before rewards" value={money(gross, c)} />
            <Row label="Profit before rewards" value={money(grossProfit, c)} />
            <Row label="Profit after rewards" strong value={money(grossProfit - given, c)} />
          </Rows>

          {rewards.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Free items <span className="font-normal text-muted">at flower cost</span></h3>
              <Rows>
                {group(rewards, s => Number(s.inventory_cost)).map(([key, g]) => (
                  <Row key={key}
                    label={REWARD_LABELS[key]?.label ?? 'Other free items'}
                    detail={`${REWARD_LABELS[key]?.detail ?? 'Free items'} · ${g.count}×`}
                    value={`−${money(g.total, c)}`} tone="danger" />
                ))}
              </Rows>
            </div>
          )}

          {discounts.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Discounts <span className="font-normal text-muted">off the price</span></h3>
              <Rows>
                {group(discounts, s => -Number(s.revenue)).map(([key, g]) => (
                  <Row key={key}
                    label={DISCOUNT_LABELS[key]?.label ?? 'Other discounts'}
                    detail={`${DISCOUNT_LABELS[key]?.detail ?? 'Discounts'} · ${g.count}×`}
                    value={`−${money(g.total, c)}`} tone="danger" />
                ))}
              </Rows>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
