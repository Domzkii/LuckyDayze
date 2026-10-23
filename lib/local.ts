'use client'

/** Small per-device conveniences. Everything here is optional; storage can be unavailable. */

export interface SavedCustomer {
  name: string
  phone: string
  payment?: 'cashapp' | 'zelle' | 'applepay' | 'cash'
  cashTag: string
  address: string
}

export interface RecentOrder {
  id: string
  created_at: string
  total: number
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const savedCustomer = () => read<Partial<SavedCustomer>>('ld_customer', {})
export const saveCustomer = (c: SavedCustomer) => write('ld_customer', c)

export const recentOrders = () => read<RecentOrder[]>('ld_orders', [])
export function rememberOrder(o: RecentOrder) {
  write('ld_orders', [o, ...recentOrders().filter(r => r.id !== o.id)].slice(0, 10))
}

/** Where this visitor first came from (?src=qr on the QR code). Kept for 30 days, sent with orders. */
const SOURCE_KEY = 'ld_source'
export function rememberSource(src: string) { write(SOURCE_KEY, { src, at: Date.now() }) }
export function visitSource() {
  const s = read<{ src: string; at: number } | null>(SOURCE_KEY, null)
  return s && Date.now() - s.at < 30 * 86_400_000 ? s.src : null
}

const AGE_KEY = 'ld_age_ok'
const AGE_DAYS = 30
export function ageVerified() {
  const at = read<number>(AGE_KEY, 0)
  return at > 0 && Date.now() - at < AGE_DAYS * 86_400_000
}
export const confirmAge = () => write(AGE_KEY, Date.now())

/** The home-screen banner shows at most twice per device, and never after it's closed. */
const INSTALL_KEY = 'ld_install'
const installState = () => read<{ shown: number; closed: boolean }>(INSTALL_KEY, { shown: 0, closed: false })
export const installBannerAllowed = () => { const s = installState(); return !s.closed && s.shown < 2 }
export const countInstallBanner = () => { const s = installState(); write(INSTALL_KEY, { ...s, shown: s.shown + 1 }) }
export const closeInstallBanner = () => write(INSTALL_KEY, { ...installState(), closed: true })
