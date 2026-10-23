export const CASHTAG = 'Luckydayz3'
export const ZELLE_PHONE = '7184198493'
/** Apple Cash goes to the same number as Zelle, sent from Messages. */
export const APPLE_CASH_PHONE = ZELLE_PHONE
export const INSTAGRAM = 'lucky_dayze'
export const BOROUGHS = ['Manhattan', 'Brooklyn'] as const
/** Everything happens in one building: pickup is at my door, delivery goes to theirs. */
export const PICKUP_PLACE = 'My door'

/** "4B" → "Apt 4B"; leaves "Apt 4B", "#4B" and street addresses alone. */
export function formatApt(value: string | null | undefined) {
  const v = (value ?? '').trim()
  if (!v) return ''
  return /^(apt|apartment|unit|#)/i.test(v) || /\s/.test(v) || v.length > 12 ? v : `Apt ${v}`
}
export const STORE_TIME_ZONE = 'America/New_York'

export const TIME_WINDOWS = ['Morning, 9am–12pm', 'Afternoon, 12–4pm', 'Evening, 4–8pm', 'Night, 8pm–12am'] as const
export const FREQUENCIES = [
  { value: 'once', label: 'One time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
] as const
/** How far ahead a scheduled delivery can be booked. */
export const MAX_SCHEDULE_DAYS = 60

/** Sizes on the menu. Old orders may still show a 1/4 oz ('7'), so it keeps its label. */
export const WEIGHTS = ['3.5', '14', '28'] as const
export const WEIGHT_LABELS: Record<string, string> = { '3.5': '1/8 oz', '7': '1/4 oz', '14': '1/2 oz', '28': '1 oz' }

export const PAYMENT_METHODS = [
  { value: 'cashapp', label: 'Cash App' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'applepay', label: 'Apple Pay' },
  { value: 'cash', label: 'Cash' },
] as const
export function paymentLabel(method: string | null | undefined) {
  return PAYMENT_METHODS.find(m => m.value === method)?.label ?? 'Cash App'
}

/** Short code customers put in the Zelle memo, so staff can match the payment. */
export function orderCode(id: string) {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase()
}

export function money(n: number, opts: { cents?: boolean } = {}) {
  const cents = opts.cents ?? !Number.isInteger(Math.round(n * 100) / 100)
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

export function roundCents(n: number) {
  return Math.round(n * 100) / 100
}

/** Ten US digits, or null. Accepts "+1 (917) 555-0100" and friends. */
export function normalizePhone(input: string): string | null {
  const digits = (input || '').replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten.length === 10 ? ten : null
}

export function formatPhone(phone: string) {
  const ten = normalizePhone(phone)
  if (!ten) return phone
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

export function firstName(name: string) {
  return (name || '').trim().split(/\s+/)[0] || 'there'
}

export function cashAppLink(amount?: number) {
  return amount && amount > 0 ? `https://cash.app/$${CASHTAG}/${amount.toFixed(2)}` : `https://cash.app/$${CASHTAG}`
}

/** Opens a Messages chat to our Apple Cash number with the order code already typed. */
export function appleCashLink(code: string) {
  return `sms:+1${APPLE_CASH_PHONE}&body=${encodeURIComponent(`LuckyDayze ${code}`)}`
}

/** Today's calendar date in New York, as YYYY-MM-DD. */
export function todayInStore() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE }).format(new Date())
}

/** "Thu, Oct 9" for a YYYY-MM-DD date, read as a calendar day (no time-zone drift). */
export function formatDay(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export function formatTime(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: STORE_TIME_ZONE,
  })
}

export function weightLabel(weight: string | null) {
  return weight ? WEIGHT_LABELS[weight] ?? `${weight}g` : ''
}
