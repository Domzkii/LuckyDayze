import type { Category, Tier } from './types'

export interface RewardDef {
  key: string
  name: string
  points: number
  category: Category
  grams: number
  tiers: Tier[]
  pickupOnlyFor: Tier[]
}

export const REWARDS: RewardDef[] = [
  { key: 'free_preroll', name: 'Free pre-roll', points: 100, category: 'Pre-Rolls', grams: 1, tiers: ['guest', 'member', 'house'], pickupOnlyFor: ['guest'] },
  { key: 'free_eighth', name: 'Free eighth', points: 300, category: 'Flower', grams: 3.5, tiers: ['member', 'house'], pickupOnlyFor: [] },
]

export const REFERRAL_GIFTS = {
  grabba: 'Pre-Roll (With Grabba)',
  plain: 'Pre-Roll (No Grabba)',
} as const
export type ReferralChoice = keyof typeof REFERRAL_GIFTS | 'later'
export const REFERRAL_REWARD_KEY = 'referral_preroll'

export const SIGNUP_POINTS = 25
export const REFERRAL_BONUS_POINTS = 25

export const MEMBER_MIN_ORDERS = 3
export const HOUSE_MIN_ORDERS = 6
export const HOUSE_MIN_POINTS = 500
export const HOUSE_MONTHLY_FEE = 25
export const HOUSE_DISCOUNT_PCT = 10
export const HOUSE_DISCOUNT_MIN = 50

export const TIERS: { key: Tier; name: string; price: string; requirement: string; perks: string[] }[] = [
  {
    key: 'guest',
    name: 'Guest',
    price: 'Free',
    requirement: 'Everyone starts here with their first order.',
    perks: ['1 point per $1 spent', '100 points: free pre-roll or gram (pickup)'],
  },
  {
    key: 'member',
    name: 'Member',
    price: 'Free',
    requirement: 'Apply after 3 orders. We approve every member personally.',
    perks: ['2× points on orders of $50+', '100 points: free pre-roll or gram', '300 points: free eighth', 'House eligibility at 500 points'],
  },
  {
    key: 'house',
    name: 'The House',
    price: '$25 / month',
    requirement: 'Member, 6 orders and 500 points to unlock.',
    perks: [
      '2× points on every order',
      '10% off orders of $50+',
      'Free pre-roll every 5th order',
      'Priority processing',
      'Event invites, gifts and the monthly oz raffle',
    ],
  },
]

export function tierName(tier: Tier) {
  return TIERS.find(t => t.key === tier)?.name ?? 'Guest'
}

export function rewardByKey(key: string) {
  return REWARDS.find(r => r.key === key)
}

/** House perks the next order earns, by count of completed orders. */
export function housePerksDue(purchaseCount: number) {
  const next = purchaseCount + 1
  const perks: string[] = []
  if (next % 5 === 0) perks.push('Free pre-roll (5th order)')
  return perks
}
