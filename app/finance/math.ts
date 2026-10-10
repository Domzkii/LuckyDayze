import type { ReupFund, Sale, Week } from '@/lib/types'

export const ROLES = [
  { key: 'ceo', label: 'CEO', desc: 'Leadership and operations' },
  { key: 'cfo', label: 'CFO', desc: 'Finance and accounting' },
  { key: 'acquisitions', label: 'Acquisitions', desc: 'Product sourcing' },
  { key: 'delivery', label: 'Delivery runner', desc: 'Per-delivery payout' },
] as const

export type RoleKey = (typeof ROLES)[number]['key']
export type Splits = Record<RoleKey, number>

export const DEFAULT_SPLITS: Splits = { ceo: 35, cfo: 20, acquisitions: 25, delivery: 20 }
export const INVESTMENT_RATE = 0.05
export const DEFAULT_REUP_GOAL = 800
export const GRAMS_PER_OZ = 28
export const GRAMS_PER_QP = 112
export const LOW_STOCK_GRAMS = 14

export function roleLabel(key: string) {
  return ROLES.find(r => r.key === key)?.label ?? key
}

export function sum<T>(rows: T[], pick: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0)
}

export function weekTotals(sales: Sale[]) {
  return {
    revenue: sum(sales, s => s.revenue),
    profit: sum(sales, s => s.net_profit),
    delivery: sum(sales, s => s.delivery_cost),
    grams: sum(sales, s => s.grams_sold),
  }
}

/** A fund that still needs money. A completed fund behaves exactly like having none. */
function openFund(fund: ReupFund | null) {
  return fund && fund.status !== 'completed' ? fund : null
}

/**
 * How this week's money will be distributed. Re-up fund fills first; once it is covered,
 * 5% of revenue goes to investment and the rest is split by role.
 */
export function projectWeek(sales: Sale[], fund: ReupFund | null, splits: Splits) {
  const totals = weekTotals(sales)
  const open = openFund(fund)
  const reupNeeded = open ? Math.max(0, (Number(open.goal) || DEFAULT_REUP_GOAL) - (Number(open.current_balance) || 0)) : 0
  const toReup = open ? Math.min(totals.profit, reupNeeded) : 0
  const surplus = open ? Math.max(0, totals.profit - reupNeeded) : totals.profit
  const investment = !open || totals.profit > reupNeeded ? totals.revenue * INVESTMENT_RATE : 0
  const teamSurplus = Math.max(0, surplus - investment)

  const payouts = ROLES.map(role => {
    const gross = (teamSurplus * splits[role.key]) / 100
    const deliveryShare = (totals.delivery * splits[role.key]) / 100
    return { role: role.key, gross, deliveryShare, net: gross - deliveryShare }
  })

  return { ...totals, reupNeeded, toReup, investment, teamSurplus, payouts, fundOpen: !!open }
}

/**
 * The exact amounts written when a week closes. Kept separate from projectWeek because the
 * team share here is not floored at zero, matching how weeks have always been closed.
 */
export function closingBook(sales: Sale[], fund: ReupFund | null, splits: Splits) {
  const totals = weekTotals(sales)
  const open = openFund(fund)
  let reupContribution = 0
  let teamProfit = 0
  let investment = 0
  let fundBalance: number | null = null
  let fundCompleted = false

  if (open) {
    const balance = Number(open.current_balance) || 0
    const goal = Number(open.goal) || DEFAULT_REUP_GOAL
    const needed = Math.max(0, goal - balance)
    if (totals.profit <= needed) {
      reupContribution = totals.profit
    } else {
      reupContribution = needed
      investment = totals.revenue * INVESTMENT_RATE
      teamProfit = totals.profit - needed - investment
    }
    fundBalance = balance + reupContribution
    fundCompleted = fundBalance >= goal
  } else {
    investment = totals.revenue * INVESTMENT_RATE
    teamProfit = totals.profit - investment
  }

  const payouts = ROLES.map(role => {
    const gross = (teamProfit * splits[role.key]) / 100
    const deliveryContribution = (totals.delivery * splits[role.key]) / 100
    return { role: role.key, gross_payout: gross, delivery_contribution: deliveryContribution, net_payout: gross - deliveryContribution }
  })

  return { totals, reupContribution, investment, teamProfit, fundBalance, fundCompleted, payouts }
}

/** Grams left over from the most recently closed week. */
export function carryoverFrom(lastClosed: Week | undefined) {
  if (!lastClosed) return 0
  const start = (Number(lastClosed.new_grams_added) || 0) + (Number(lastClosed.carried_over_grams) || 0)
  return Math.max(0, start - (Number(lastClosed.total_grams_sold) || 0))
}

export function formatWeight(grams: number) {
  return `${(grams / GRAMS_PER_OZ).toFixed(2)} oz · ${grams.toFixed(1)} g`
}

export function round2(n: number) {
  return Math.round(n * 100) / 100
}
