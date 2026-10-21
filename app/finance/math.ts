import type { ReupFund, Sale, Week } from '@/lib/types'

/** The partners who get paid when a week closes. */
export const ROLES = [
  { key: 'hussein', label: 'Hussein' },
  { key: 'dominic', label: 'Dominic' },
] as const

/** Everything profit is split into once the re-up fund is covered: the partners plus the investment fund. */
export const SPLIT_PARTS = [...ROLES, { key: 'investment', label: 'Investment fund' }] as const

export type RoleKey = (typeof ROLES)[number]['key']
export type SplitKey = (typeof SPLIT_PARTS)[number]['key']
export type Splits = Record<SplitKey, number>

export const DEFAULT_SPLITS: Splits = { hussein: 75, dominic: 20, investment: 5 }
export const DEFAULT_REUP_GOAL = 410
export const GRAMS_PER_OZ = 28
export const GRAMS_PER_QP = 112
export const LOW_STOCK_GRAMS = 14

// Roles from before the team was two partners, so old payouts still read well.
const OLD_ROLES: Record<string, string> = { ceo: 'CEO', cfo: 'CFO', acquisitions: 'Acquisitions', delivery: 'Delivery runner' }

export function roleLabel(key: string) {
  return ROLES.find(r => r.key === key)?.label ?? OLD_ROLES[key] ?? key
}

/** The saved split, falling back to the default for anything missing or malformed. */
export function readSplits(saved: unknown): Splits {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  return Object.fromEntries(SPLIT_PARTS.map(p => {
    const n = Number(s[p.key])
    return [p.key, Number.isFinite(n) && n >= 0 ? n : DEFAULT_SPLITS[p.key]]
  })) as Splits
}

export function splitTotal(splits: Splits) {
  return SPLIT_PARTS.reduce((t, p) => t + splits[p.key], 0)
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
 * How this week's money will be distributed. Profit fills the re-up fund first; whatever is
 * left splits between the partners and the investment fund.
 */
export function projectWeek(sales: Sale[], fund: ReupFund | null, splits: Splits) {
  const totals = weekTotals(sales)
  const open = openFund(fund)
  const reupNeeded = open ? Math.max(0, (Number(open.goal) || DEFAULT_REUP_GOAL) - (Number(open.current_balance) || 0)) : 0
  const toReup = open ? Math.max(0, Math.min(totals.profit, reupNeeded)) : 0
  const surplus = Math.max(0, totals.profit - reupNeeded)
  const investment = (surplus * splits.investment) / 100
  const payouts = ROLES.map(role => ({ role: role.key, amount: (surplus * splits[role.key]) / 100 }))
  return { ...totals, reupNeeded, toReup, surplus, investment, payouts, fundOpen: !!open }
}

/**
 * The exact amounts written when a week closes. Unlike projectWeek, a week that lost money
 * with no re-up fund open records negative payouts, so the books still balance.
 */
export function closingBook(sales: Sale[], fund: ReupFund | null, splits: Splits) {
  const totals = weekTotals(sales)
  const open = openFund(fund)
  let reupContribution = 0
  let toSplit = totals.profit
  let fundBalance: number | null = null
  let fundCompleted = false

  if (open) {
    const balance = Number(open.current_balance) || 0
    const goal = Number(open.goal) || DEFAULT_REUP_GOAL
    const needed = Math.max(0, goal - balance)
    reupContribution = Math.min(totals.profit, needed)
    toSplit = totals.profit - reupContribution
    fundBalance = balance + reupContribution
    fundCompleted = fundBalance >= goal
  }

  const investment = toSplit > 0 ? (toSplit * splits.investment) / 100 : 0
  const payouts = ROLES.map(role => {
    const amount = (toSplit * splits[role.key]) / 100
    return { role: role.key, gross_payout: amount, delivery_contribution: 0, net_payout: amount }
  })

  return { totals, reupContribution, investment, toSplit, fundBalance, fundCompleted, payouts }
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
