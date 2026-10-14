export type Category = 'Flower' | 'Pre-Rolls'
export type StrainType = 'Sativa' | 'Indica' | 'Hybrid'
export type Fulfillment = 'delivery' | 'pickup' | 'scheduled'
export type Tier = 'guest' | 'member' | 'house'
export type PaymentMethod = 'cashapp' | 'zelle' | 'cash'
export type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly'

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export interface Product {
  id: string
  created_at: string
  name: string
  category: Category
  price: number
  weight_prices: Record<string, number>
  thc: string | null
  strain_type: StrainType
  description: string | null
  stock_grams: number
  in_stock: boolean
  is_popular: boolean
  archived: boolean
  image_urls: string[]
}

export interface StoreSettings {
  id: number
  is_open: boolean
  delivery_minimum: number
  cost_per_gram: number
  updated_at: string
}

export interface PickupLocation {
  id: string
  created_at: string
  borough: string
  address: string
  description: string | null
  is_active: boolean
}

export interface SaleEvent {
  id: string
  created_at: string
  title: string
  discount_type: 'percent' | 'dollar'
  discount_value: number
  applies_to: 'all' | 'flower' | 'prerolls'
  is_active: boolean
}

export interface OrderItem {
  product_id: string | null
  name: string
  category: Category
  weight: string | null
  grams: number
  qty: number
  unit_price: number
  line_total: number
  is_reward?: boolean
  reward_key?: string
}

/** What kind of money we gave up. Older orders may not have one; 'house' and 'scheduled' are retired. */
export type DiscountKind = 'preroll_deal' | 'promo' | 'perk' | 'credit' | 'house' | 'scheduled'

export interface Discount {
  label: string
  amount: number
  kind?: DiscountKind
}

export interface Order {
  id: string
  created_at: string
  fulfillment: Fulfillment
  status: OrderStatus
  customer_name: string
  customer_phone: string
  customer_address: string | null
  pickup_location_id: string | null
  pickup_location_address: string | null
  order_notes: string | null
  payment_method: PaymentMethod
  cash_tag: string | null
  items: OrderItem[]
  subtotal: number
  discounts: Discount[]
  total: number
  referral_code: string | null
  referral_reward: string | null
  reward_key: string | null
  reward_points: number
  scheduled_order_id: string | null
  customer_arrived: boolean
  delivery_cost: number | null
  delivered_at: string | null
  perk: 'prerolls' | 'credit' | 'eighth' | null
  credit_used: number
}

export interface ScheduledOrder {
  id: string
  created_at: string
  status: 'pending' | 'completed' | 'cancelled'
  customer_name: string
  customer_phone: string
  customer_address: string
  order_notes: string | null
  payment_method: PaymentMethod
  cash_tag: string | null
  items: OrderItem[]
  subtotal: number
  discounts: Discount[]
  total: number
  delivery_date: string
  delivery_time_window: string | null
  frequency: Frequency
  recurring_count: number
  referral_code: string | null
  referral_reward: string | null
}

export interface Loyalty {
  id: string
  created_at: string
  customer_phone: string
  customer_name: string
  email: string | null
  birthday: string | null
  points: number
  purchase_count: number
  total_spent: number
  membership_tier: Tier
  membership_requested: 'member' | 'house' | null
  house_paid_until: string | null
  referral_code: string
  referred_by: string | null
  referral_count: number
  pending_referral_reward: string | null
  next_order_credit: number
}

export interface MembershipRequest {
  id: string
  created_at: string
  customer_phone: string
  customer_name: string
  customer_email: string | null
  customer_birthday: string | null
  requested_tier: 'member' | 'house'
  status: 'pending' | 'approved' | 'declined'
}

export interface Week {
  id: string
  created_at: string
  week_number: number
  start_date: string
  end_date: string | null
  carried_over_grams: number
  new_grams_added: number
  total_revenue: number | null
  total_profit: number | null
  total_delivery_costs: number | null
  total_grams_sold: number | null
  status: 'active' | 'closed'
}

export interface Sale {
  id: string
  created_at: string
  order_id: string
  week_id: string | null
  product_id: string | null
  product_name: string
  category: Category
  grams_sold: number
  revenue: number
  inventory_cost: number
  delivery_cost: number
  net_profit: number
  delivery_shares: Record<string, number>
  /** 'sale': an item sold. 'discount': money taken off (negative revenue). 'reward': a free item, at cost. */
  kind: 'sale' | 'discount' | 'reward'
  /** For discounts, the DiscountKind; for rewards, the reward key (perk_prerolls, free_eighth, referral_preroll…). */
  reward_type: string | null
}

export interface WeekPayout {
  id: string
  created_at: string
  week_id: string
  role: string
  gross_payout: number
  delivery_contribution: number
  net_payout: number
}

export interface ReupFund {
  id: string
  created_at: string
  week_id: string | null
  goal: number
  current_balance: number
  status: 'active' | 'completed'
}

export interface InvestmentEntry {
  id: string
  created_at: string
  week_id: string | null
  contribution: number
  running_total: number
  week_revenue: number
}

/** What the order page is allowed to show a customer. No phone, no delivery address. */
export interface PublicOrder {
  id: string
  created_at: string
  fulfillment: Fulfillment
  status: OrderStatus
  first_name: string
  pickup_location_address: string | null
  items: OrderItem[]
  subtotal: number
  discounts: Discount[]
  total: number
  customer_arrived: boolean
  perk: 'prerolls' | 'credit' | 'eighth' | null
  payment_method: PaymentMethod
}

/** What the rewards page is allowed to show for a phone number. */
export interface PublicRewards {
  first_name: string
  tier: Tier
  points: number
  purchase_count: number
  referral_code: string
  referral_count: number
  referred: boolean
  pending_referral_reward: string | null
  membership_requested: 'member' | 'house' | null
  house_paid_until: string | null
  next_order_credit: number
}
