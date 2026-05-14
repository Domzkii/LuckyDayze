'use client'

import { useState } from 'react'
import { supabase } from '../supabase'

const TIERS = [
  { name: 'Starter', min: 0, color: 'text-white/60', bg: 'bg-white/10' },
  { name: 'Silver', min: 100, color: 'text-gray-300', bg: 'bg-gray-500/20' },
  { name: 'Gold', min: 200, color: 'text-[#c9a84c]', bg: 'bg-[#c9a84c]/20' },
  { name: 'Platinum', min: 500, color: 'text-blue-300', bg: 'bg-blue-500/20' },
]

const REWARDS = [
  { points: 50, label: '$5 off your order', emoji: '💚' },
  { points: 100, label: '$10 off your order', emoji: '🌿' },
  { points: 150, label: 'Free delivery', emoji: '🚗' },
  { points: 200, label: 'Free pre-roll added', emoji: '🚬' },
  { points: 300, label: 'Free 1g flower', emoji: '🌸' },
  { points: 500, label: 'VIP goodie bag', emoji: '👑' },
]

export default function RewardsPage() {
  const [phone, setPhone] = useState('')
  const [loyalty, setLoyalty] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [redeeming, setRedeeming] = useState<any>(null)
  const [redeemed, setRedeemed] = useState(false)

  async function lookupPoints() {
    if (!phone) return
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('loyalty')
      .select('*')
      .eq('customer_phone', phone)
    console.log('data:', data)
    console.log('error:', error)
    setLoading(false)
    if (!data || data.length === 0) {
      setError('No account found for that number. Place an order first to start earning points!')
      setLoyalty(null)
    } else {
      setLoyalty(data[0])
    }
  }

  async function redeemReward(reward: any) {
    if (!loyalty || loyalty.points < reward.points) return
    setRedeeming(reward)
    await supabase
      .from('loyalty')
      .update({ points: loyalty.points - reward.points })
      .eq('customer_phone', phone)
    setLoyalty({ ...loyalty, points: loyalty.points - reward.points })
    setRedeeming(null)
    setRedeemed(true)
    setTimeout(() => setRedeemed(false), 3000)
  }

  function getTier(totalSpent: number) {
    if (totalSpent >= 500) return TIERS[3]
    if (totalSpent >= 200) return TIERS[2]
    if (totalSpent >= 100) return TIERS[1]
    return TIERS[0]
  }

  function getNextTier(totalSpent: number) {
    if (totalSpent >= 500) return null
    if (totalSpent >= 200) return { name: 'Platinum', needed: 500 - totalSpent }
    if (totalSpent >= 100) return { name: 'Gold', needed: 200 - totalSpent }
    return { name: 'Silver', needed: 100 - totalSpent }
  }

  function getProgressPct(totalSpent: number) {
    if (totalSpent >= 500) return 100
    if (totalSpent >= 200) return ((totalSpent - 200) / 300) * 100
    if (totalSpent >= 100) return ((totalSpent - 100) / 100) * 100
    return (totalSpent / 100) * 100
  }

  return (
    <main className="min-h-screen bg-[#0a0c0b] text-[#f0ede6]">

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0a0c0b]/90 backdrop-blur z-40">
        <a href="/" className="text-[#c9a84c] text-2xl font-bold tracking-tight">
          LuckyDayze
        </a>
        <div className="text-sm text-white/50">Lucky Rewards</div>
        <a href="/" className="bg-[#1c201e] border border-white/10 text-white/60 text-sm font-bold px-5 py-2 rounded-full">
          Shop
        </a>
      </nav>

      <div className="max-w-md mx-auto px-6 py-10">

        {/* HEADER */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">👑</div>
          <h1 className="text-3xl font-bold mb-2">Lucky Rewards</h1>
          <p className="text-white/40 text-sm">Earn 1 point for every $1 spent. Redeem for discounts and free products.</p>
        </div>

        {/* LOOKUP */}
        {!loyalty && (
          <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-6 mb-6">
            <h3 className="font-bold mb-4">Check Your Points</h3>
            <input
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-[#242927] border border-white/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c]/50 placeholder-white/30"
            />
            <button
              onClick={lookupPoints}
              disabled={loading}
              className="w-full bg-[#c9a84c] text-black font-bold py-3 rounded-xl hover:bg-[#e8c97a] transition-all disabled:opacity-50"
            >
              {loading ? 'Looking up...' : 'Check My Points'}
            </button>
            {error && (
              <p className="text-white/40 text-xs text-center mt-4">{error}</p>
            )}
          </div>
        )}

        {/* POINTS DISPLAY */}
        {loyalty && (
          <>
            {redeemed && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-6 text-center">
                <div className="text-2xl mb-1">🎉</div>
                <p className="text-green-400 font-bold">Reward redeemed! Show this to your driver.</p>
              </div>
            )}

            <div className="bg-gradient-to-br from-[#1a3d2b] to-[#0f2419] border border-[#c9a84c]/20 rounded-2xl p-6 mb-6 text-center">
              <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${getTier(loyalty.total_spent).color}`}>
                {getTier(loyalty.total_spent).name} Member
              </div>
              <div className="text-6xl font-bold text-[#c9a84c] mb-1">{loyalty.points}</div>
              <div className="text-white/40 text-sm mb-6">Lucky Points</div>

              {getNextTier(loyalty.total_spent) && (
                <>
                  <div className="flex justify-between text-xs text-white/40 mb-2">
                    <span>{getTier(loyalty.total_spent).name}</span>
                    <span>${getNextTier(loyalty.total_spent)?.needed.toFixed(0)} to {getNextTier(loyalty.total_spent)?.name}</span>
                  </div>
                  <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#1a3d2b] to-[#c9a84c] rounded-full transition-all"
                      style={{ width: `${getProgressPct(loyalty.total_spent)}%` }}
                    />
                  </div>
                </>
              )}

              {!getNextTier(loyalty.total_spent) && (
                <div className="text-[#c9a84c] text-sm font-bold">🏆 Maximum tier reached!</div>
              )}
            </div>

            <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/40">Total spent</span>
                <span className="font-bold">${loyalty.total_spent.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Member since</span>
                <span className="font-bold">{new Date(loyalty.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* REWARDS */}
            <h3 className="font-bold mb-4">Available Rewards</h3>
            <div className="flex flex-col gap-3 mb-8">
              {REWARDS.map(reward => {
                const canRedeem = loyalty.points >= reward.points
                return (
                  <div
                    key={reward.points}
                    className={`bg-[#1c201e] border rounded-2xl p-4 flex items-center gap-4 ${
                      canRedeem ? 'border-[#c9a84c]/30' : 'border-white/10 opacity-50'
                    }`}
                  >
                    <div className="text-3xl">{reward.emoji}</div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{reward.label}</div>
                      <div className="text-white/40 text-xs">{reward.points} points</div>
                    </div>
                    <button
                      onClick={() => redeemReward(reward)}
                      disabled={!canRedeem || redeeming}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        canRedeem
                          ? 'bg-[#c9a84c] text-black hover:bg-[#e8c97a]'
                          : 'bg-white/10 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      {canRedeem ? 'Redeem' : 'Locked'}
                    </button>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => { setLoyalty(null); setPhone('') }}
              className="w-full border border-white/10 text-white/40 py-3 rounded-xl text-sm hover:border-white/20 transition-all"
            >
              Look up a different number
            </button>
          </>
        )}

        {/* HOW IT WORKS */}
        {!loyalty && (
          <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold mb-4">How It Works</h3>
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 items-start">
                <div className="text-2xl">🛒</div>
                <div>
                  <div className="font-bold text-sm mb-1">Place an order</div>
                  <div className="text-white/40 text-xs">Earn 1 point for every $1 you spend</div>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="text-2xl">📈</div>
                <div>
                  <div className="font-bold text-sm mb-1">Level up your tier</div>
                  <div className="text-white/40 text-xs">Starter → Silver → Gold → Platinum</div>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="text-2xl">🎁</div>
                <div>
                  <div className="font-bold text-sm mb-1">Redeem rewards</div>
                  <div className="text-white/40 text-xs">Use points for discounts and free products</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}