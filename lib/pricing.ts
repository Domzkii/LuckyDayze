import { HOUSE_DISCOUNT_MIN, HOUSE_DISCOUNT_PCT } from './rewards'
import { roundCents } from './format'
import type { Category, Discount, Product, SaleEvent, Tier } from './types'

/** One line in the cart, as the browser keeps it. Prices are re-derived from products on the server. */
export interface CartLine {
  key: string
  productId: string | null
  name: string
  category: Category
  weight: string | null
  qty: number
  image: string | null
  rewardKey?: string
}

export interface PricedLine extends CartLine {
  unitPrice: number
  grams: number
  lineTotal: number
}

export interface Quote {
  lines: PricedLine[]
  /** Sum of line totals before any discount. */
  subtotal: number
  discounts: Discount[]
  total: number
  /** Merchandise value after bundle deals, used for the delivery minimum. */
  merchandise: number
  /** The order's one deal, or null. */
  deal: Deal | null
  /** Deals this order qualified for but didn't get, because a better one won. */
  passedOver: Deal[]
}

/** Any two pre-rolls, mixed or matched. */
export const PREROLL_DEAL = { size: 2, price: 15, label: 'Pre-roll deal: 2 for $15', short: '2 for $15' }

/** Spend perks, measured on merchandise after the pre-roll deal. */
export const PERKS = {
  choiceMin: 60,
  eighthMin: 150,
  freePreRolls: 2,
  /** Dollars off the customer's next order, if they choose that over the pre-rolls. */
  credit: 7,
}
export type PerkChoice = 'prerolls' | 'credit'
export type PerkKind = PerkChoice | 'eighth'

/** What each perk is worth to the customer, at retail. Used to pick the order's one best deal. */
export const PERK_VALUE: Record<PerkKind, number> = {
  prerolls: PREROLL_DEAL.price,
  credit: PERKS.credit,
  eighth: 30,
}

/** "Spend $12 more for …", or null once the top perk is reached. */
export function perkNudge(merchandise: number) {
  const fmt = (n: number) => `$${(Math.ceil(n * 100) / 100).toFixed(Number.isInteger(Math.ceil(n * 100) / 100) ? 0 : 2)}`
  if (merchandise < PERKS.choiceMin) {
    return `Spend ${fmt(PERKS.choiceMin - merchandise)} more for ${PERKS.freePreRolls} free pre-rolls or $${PERKS.credit} off your next order.`
  }
  if (merchandise < PERKS.eighthMin) return `Spend ${fmt(PERKS.eighthMin - merchandise)} more for a free 1/8 instead.`
  return null
}

/** Which spend perk an order of this size unlocks. The free 1/8 replaces the $60 perk. */
export function perkTier(merchandise: number): 'eighth' | 'choice' | null {
  if (merchandise >= PERKS.eighthMin) return 'eighth'
  if (merchandise >= PERKS.choiceMin) return 'choice'
  return null
}

export function unitPriceFor(product: Product, weight: string | null) {
  if (product.category === 'Flower') {
    const w = weight ?? '3.5'
    const fromTable = Number(product.weight_prices?.[w])
    if (fromTable > 0) return fromTable
    // The plain price only stands in for a 1/8 when no weight prices are set at all.
    const hasTable = Object.values(product.weight_prices || {}).some(p => Number(p) > 0)
    return w === '3.5' && !hasTable ? Number(product.price) : 0
  }
  return Number(product.price)
}

export function gramsFor(product: Pick<Product, 'category'>, weight: string | null) {
  return product.category === 'Flower' ? Number(weight ?? '3.5') : 1
}

/** "from $30" price for a card. */
export function startingPrice(product: Product) {
  if (product.category !== 'Flower') return Number(product.price)
  const prices = Object.values(product.weight_prices || {}).map(Number).filter(p => p > 0)
  return prices.length ? Math.min(...prices) : Number(product.price)
}

/** Savings from pre-roll bundles. Units are grouped most-expensive first. */
function bundleDiscount(unitPrices: number[], size: number, bundlePrice: number) {
  const sorted = [...unitPrices].sort((a, b) => b - a)
  let saved = 0
  for (let i = 0; i + size <= sorted.length; i += size) {
    const group = sorted.slice(i, i + size).reduce((a, b) => a + b, 0)
    saved += Math.max(0, group - bundlePrice)
  }
  return saved
}

export interface QuoteOptions {
  sale: SaleEvent | null
  tier: Tier | null
  /** Scheduled for a later calendar day than today. */
  scheduledAhead: boolean
  /** Dollars off banked from a previous $60+ order. */
  credit?: number
  /** The spend perk this order would earn, if any. Competes with the discounts as one of the deals. */
  perk?: PerkKind | null
}

/** The one deal an order gets: whichever is worth most to the customer. */
export interface Deal {
  kind: 'perk' | 'promo' | 'house' | 'credit' | 'scheduled'
  label: string
  /** Retail value to the customer. */
  value: number
}

export function quote(cart: CartLine[], products: Product[], opts: QuoteOptions): Quote {
  const byId = new Map(products.map(p => [p.id, p]))
  const lines: PricedLine[] = []

  for (const line of cart) {
    if (line.rewardKey) {
      lines.push({ ...line, unitPrice: 0, grams: line.weight ? Number(line.weight) : line.category === 'Flower' ? 3.5 : 1, lineTotal: 0 })
      continue
    }
    const product = line.productId ? byId.get(line.productId) : undefined
    if (!product) continue
    const unitPrice = unitPriceFor(product, line.weight)
    if (!(unitPrice > 0)) continue
    lines.push({
      ...line,
      // Never trust the cart's own label for these; the product decides.
      name: product.name,
      category: product.category,
      weight: product.category === 'Flower' ? line.weight ?? '3.5' : null,
      unitPrice,
      grams: gramsFor(product, line.weight),
      lineTotal: roundCents(unitPrice * line.qty),
    })
  }

  const subtotal = roundCents(lines.reduce((s, l) => s + l.lineTotal, 0))
  const discounts: Discount[] = []

  const preRollUnits = lines
    .filter(l => !l.rewardKey && l.category === 'Pre-Rolls')
    .flatMap(l => Array<number>(l.qty).fill(l.unitPrice))
  const preRollSaved = bundleDiscount(preRollUnits, PREROLL_DEAL.size, PREROLL_DEAL.price)
  if (preRollSaved > 0) discounts.push({ label: PREROLL_DEAL.label, amount: roundCents(preRollSaved), kind: 'preroll_deal' })

  const flowerTotal = lines.filter(l => !l.rewardKey && l.category === 'Flower').reduce((s, l) => s + l.lineTotal, 0)
  const preRollTotal = lines.filter(l => !l.rewardKey && l.category === 'Pre-Rolls').reduce((s, l) => s + l.lineTotal, 0) - preRollSaved
  const merchandise = roundCents(flowerTotal + preRollTotal)

  // One deal per order. The pre-roll 2-for-$15 above is pricing, not a deal, so it always applies.
  const candidates: (Deal & { discount: number })[] = []
  const { sale } = opts
  if (sale) {
    const eligible = sale.applies_to === 'all' ? merchandise : sale.applies_to === 'flower' ? flowerTotal : preRollTotal
    const amount = sale.discount_type === 'percent' ? eligible * (Number(sale.discount_value) / 100) : Math.min(Number(sale.discount_value), eligible)
    if (amount > 0) candidates.push({ kind: 'promo', label: sale.title, value: roundCents(amount), discount: roundCents(amount) })
  }
  if (opts.tier === 'house' && merchandise >= HOUSE_DISCOUNT_MIN) {
    const amount = roundCents(merchandise * (HOUSE_DISCOUNT_PCT / 100))
    candidates.push({ kind: 'house', label: `House: ${HOUSE_DISCOUNT_PCT}% off`, value: amount, discount: amount })
  }
  if (opts.credit && opts.credit > 0 && merchandise > 0) {
    const amount = roundCents(Math.min(opts.credit, merchandise))
    candidates.push({ kind: 'credit', label: `$${opts.credit} off from your last order`, value: amount, discount: amount })
  }
  if (opts.scheduledAhead) {
    const amount = roundCents(merchandise * 0.05)
    candidates.push({ kind: 'scheduled', label: 'Scheduled ahead: 5% off', value: amount, discount: amount })
  }
  if (opts.perk) {
    const label = opts.perk === 'eighth' ? 'Free 1/8' : opts.perk === 'prerolls' ? `${PERKS.freePreRolls} free pre-rolls` : `$${PERKS.credit} off your next order`
    candidates.push({ kind: 'perk', label, value: PERK_VALUE[opts.perk], discount: 0 })
  }

  // Highest value wins; on a tie the perk wins, since it costs us less than cash off.
  const ranked = [...candidates].sort((a, b) => b.value - a.value || (a.kind === 'perk' ? -1 : b.kind === 'perk' ? 1 : 0))
  const best = ranked[0] ?? null
  if (best && best.discount > 0) {
    discounts.push({ label: best.label, amount: best.discount, kind: best.kind as Exclude<Deal['kind'], 'perk'> })
  }
  const strip = ({ kind, label, value }: Deal) => ({ kind, label, value })
  const deal = best ? strip(best) : null
  const passedOver = ranked.slice(1).map(strip)

  const discountTotal = discounts.reduce((s, d) => s + d.amount, 0)
  const total = roundCents(Math.max(0, subtotal - discountTotal))

  return { lines, subtotal, discounts, total, merchandise, deal, passedOver }
}
