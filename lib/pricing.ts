import { roundCents } from './format'
import type { Category, Discount, Product, SaleEvent, SpecialPrices } from './types'

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

/** Spend perks: dollars off this order, measured on merchandise after the pre-roll deal. Highest step wins. */
export const PERKS = [
  { min: 60, off: 5 },
  { min: 150, off: 15 },
] as const

/**
 * New sign-ups: dollars off a first order placed from an account. Stacks on top of the one deal.
 * Runs through Monday 10/26 at 11:59pm NY time (midnight EDT is 04:00 UTC).
 */
export const WELCOME_OFFER = { off: 5, endsAt: '2026-10-27T04:00:00Z', label: 'Welcome: $5 off your first order', through: 'Monday' }

export function welcomeOfferLive(now = new Date()) {
  return now < new Date(WELCOME_OFFER.endsAt)
}

/** The spend perk an order of this size earns, or null. */
export function perkFor(merchandise: number) {
  return [...PERKS].reverse().find(p => merchandise >= p.min) ?? null
}

/** "Spend $12 more for $5 off", or null once the top perk is reached. */
export function perkNudge(merchandise: number) {
  const next = PERKS.find(p => merchandise < p.min)
  if (!next) return null
  const more = Math.ceil((next.min - merchandise) * 100) / 100
  return `Spend $${Number.isInteger(more) ? more : more.toFixed(2)} more for $${next.off} off this order.`
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
  /** Dollars off banked from an older order (the retired "$7 off next time" perk). */
  credit?: number
  /** A signed-in customer's special flower prices. */
  special?: SpecialPrices | null
  /** A new account's first order during the welcome offer. */
  welcome?: boolean
}

/** Flower price for this size from a special price list, if it beats the regular one. */
export function specialPriceFor(special: SpecialPrices | null | undefined, weight: string | null, regular: number) {
  const p = Number(special?.[weight ?? '3.5'])
  return p > 0 && p < regular ? p : null
}

/** The one deal an order gets: whichever is worth most to the customer. */
export interface Deal {
  kind: 'perk' | 'promo' | 'credit' | 'special'
  label: string
  /** Dollars off. */
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
  if (opts.credit && opts.credit > 0 && merchandise > 0) {
    const amount = roundCents(Math.min(opts.credit, merchandise))
    candidates.push({ kind: 'credit', label: `$${opts.credit} off from your last order`, value: amount, discount: amount })
  }
  if (opts.special) {
    const saved = lines
      .filter(l => !l.rewardKey && l.category === 'Flower')
      .reduce((s, l) => {
        const p = specialPriceFor(opts.special, l.weight, l.unitPrice)
        return p === null ? s : s + (l.unitPrice - p) * l.qty
      }, 0)
    if (saved > 0) candidates.push({ kind: 'special', label: 'Your prices', value: roundCents(saved), discount: roundCents(saved) })
  }
  const perk = perkFor(merchandise)
  if (perk) {
    candidates.push({ kind: 'perk', label: `Spend $${perk.min}: $${perk.off} off`, value: perk.off, discount: perk.off })
  }

  // Highest value wins; on a tie the spend perk wins, since it doesn't use up anything banked.
  const ranked = [...candidates].sort((a, b) => b.value - a.value || (a.kind === 'perk' ? -1 : b.kind === 'perk' ? 1 : 0))
  const best = ranked[0] ?? null
  if (best && best.discount > 0) {
    discounts.push({ label: best.label, amount: best.discount, kind: best.kind })
  }
  const strip = ({ kind, label, value }: Deal) => ({ kind, label, value })
  const deal = best ? strip(best) : null
  const passedOver = ranked.slice(1).map(strip)

  // The welcome offer isn't a deal: it comes off on top, never below zero merchandise.
  if (opts.welcome) {
    const left = merchandise - (best?.discount ?? 0)
    const amount = roundCents(Math.min(WELCOME_OFFER.off, left))
    if (amount > 0) discounts.push({ label: WELCOME_OFFER.label, amount, kind: 'welcome' })
  }

  const discountTotal = discounts.reduce((s, d) => s + d.amount, 0)
  const total = roundCents(Math.max(0, subtotal - discountTotal))

  return { lines, subtotal, discounts, total, merchandise, deal, passedOver }
}
