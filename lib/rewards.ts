import type { Category } from './types'

export interface RewardDef {
  key: string
  name: string
  points: number
  category: Category
  grams: number
}

export const REWARDS: RewardDef[] = [
  { key: 'free_preroll', name: 'Free pre-roll', points: 100, category: 'Pre-Rolls', grams: 1 },
  { key: 'free_eighth', name: 'Free eighth', points: 300, category: 'Flower', grams: 3.5 },
]

export const REFERRAL_GIFTS = {
  grabba: 'Pre-Roll (With Grabba)',
  plain: 'Pre-Roll (No Grabba)',
} as const
export type ReferralChoice = keyof typeof REFERRAL_GIFTS | 'later'
export const REFERRAL_REWARD_KEY = 'referral_preroll'

export const SIGNUP_POINTS = 25
export const REFERRAL_BONUS_POINTS = 25
/** What the person who shared the code gets when their friend's first order is delivered (complete_order in SQL). */
export const REFERRER_POINTS = 25

// Member and The House tiers are on hold until the numbers are worked out; see git history.

export function rewardByKey(key: string) {
  return REWARDS.find(r => r.key === key)
}
