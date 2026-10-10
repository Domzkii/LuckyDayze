'use client'

/** Small per-device conveniences. Everything here is optional; storage can be unavailable. */

export interface SavedCustomer {
  name: string
  phone: string
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

const AGE_KEY = 'ld_age_ok'
const AGE_DAYS = 30
export function ageVerified() {
  const at = read<number>(AGE_KEY, 0)
  return at > 0 && Date.now() - at < AGE_DAYS * 86_400_000
}
export const confirmAge = () => write(AGE_KEY, Date.now())

export const installPromptSeen = () => read<boolean>('ld_install_seen', false)
export const markInstallPromptSeen = () => write('ld_install_seen', true)
