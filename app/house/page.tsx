'use client'

import { useState } from 'react'
import { supabase } from '../supabase'
import { useTheme } from '../theme'

export default function HousePage() {
    const { toggle } = useTheme()
  const [phone, setPhone] = useState('')
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [notHouse, setNotHouse] = useState(false)

  async function lookup() {
    if (!phone) return
    setLoading(true)
    setNotFound(false)
    setNotHouse(false)
    setMember(null)

    const { data } = await supabase
      .from('loyalty')
      .select('*')
      .eq('customer_phone', phone.replace(/\D/g, ''))
      .single()

    setLoading(false)

    if (!data) { setNotFound(true); return }
    if (data.membership_tier !== 'house') { setNotHouse(true); return }
    setMember(data)
  }

  const purchaseCount = member?.purchase_count || 0
  const points = member?.points || 0
  const nextFreePreRoll = 5 - (purchaseCount % 5) === 5 ? 0 : 5 - (purchaseCount % 5)
  const nextFreeEighth = 10 - (purchaseCount % 10) === 10 ? 0 : 10 - (purchaseCount % 10)
  const preRollProgress = ((purchaseCount % 5) / 5) * 100
  const eighthProgress = ((purchaseCount % 10) / 10) * 100

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-[#f5f0e8]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/10 sticky top-0 bg-[#0f0f0f]/95 backdrop-blur z-40">
        <div>
          <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold tracking-wider text-[#c9a84c]">THE HOUSE</div>
          <div className="text-xs tracking-widest uppercase text-[#666]">Members Only</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggle} className="text-lg">☀️</button>
          <a href="/" className="border border-white/10 text-[#999] text-sm font-bold px-4 py-2 rounded-full hover:border-white/30 transition-all">Store</a>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-6 py-10">
        {!member ? (
          <>
            {/* HERO */}
            <div className="text-center mb-10">
              <div className="text-5xl mb-4">👑</div>
              <h1 style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-2 text-[#c9a84c]">Welcome to The House</h1>
              <p className="text-[#666] text-sm">Enter your phone number to access your exclusive member dashboard.</p>
            </div>

            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
              <input type="tel" placeholder="Your phone number" value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') lookup() }}
                className="w-full bg-[#222] border border-white/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#555] text-[#f5f0e8]" />
              {notFound && <p className="text-red-400 text-xs mb-3">No account found for that number.</p>}
              {notHouse && (
                <div className="bg-[#222] border border-white/10 rounded-xl p-4 mb-3">
                  <p className="text-[#999] text-sm mb-1">You're not a House member yet.</p>
                  <p className="text-xs text-[#666]">Check your eligibility on the <a href="/rewards" className="text-[#c9a84c] underline">Rewards page</a>.</p>
                </div>
              )}
              <button onClick={lookup} disabled={loading}
                className="w-full bg-[#c9a84c] text-[#1a1a1a] font-bold py-3 rounded-xl hover:bg-[#e8c97a] transition-all disabled:opacity-50">
                {loading ? 'Looking up...' : 'Enter The House'}
              </button>
            </div>

            {/* PERKS PREVIEW */}
            <div className="mt-10">
              <p className="text-xs uppercase tracking-widest text-[#555] mb-4 text-center">House Member Perks</p>
              <div className="flex flex-col gap-2">
                {[
                  '2x points on every order',
                  '10% off orders over $50',
                  'Free pre-roll every 5th purchase',
                  'Free eighth every 10th purchase',
                  'Priority order processing',
                  'Event invites + surprise gifts',
                  'Monthly free oz raffle entry'
                ].map((perk, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-xl border border-white/5">
                    <span className="text-[#c9a84c] font-bold">✓</span>
                    <span className="text-sm text-[#999]">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* WELCOME HEADER */}
            <div className="bg-[#1a1a1a] border border-[#c9a84c]/30 rounded-2xl p-6 mb-6 text-center">
              <div className="text-4xl mb-2">👑</div>
              <h1 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-[#c9a84c] mb-1">Welcome back, {member.customer_name}!</h1>
              <p className="text-[#666] text-xs">House Member · Active</p>
              {member.house_paid_until && (
                <div className="mt-3 bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-4 py-2">
                  <p className="text-[#c9a84c] text-xs font-bold">Membership active until {member.house_paid_until}</p>
                </div>
              )}
            </div>

            {/* STATS */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-center">
                <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-[#c9a84c]">{points}</div>
                <div className="text-[#666] text-xs mt-1">Points</div>
              </div>
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-center">
                <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold">{purchaseCount}</div>
                <div className="text-[#666] text-xs mt-1">Orders</div>
              </div>
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-center">
                <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold">${(member.total_spent || 0).toFixed(0)}</div>
                <div className="text-[#666] text-xs mt-1">Spent</div>
              </div>
            </div>

            {/* MILESTONE TRACKERS */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 mb-6">
              <div className="text-xs uppercase tracking-widest text-[#c9a84c] mb-4">Milestone Rewards</div>

              {/* FREE PRE-ROLL */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-bold text-sm">Free Pre-Roll</p>
                    <p className="text-[#666] text-xs">Every 5th purchase</p>
                  </div>
                  {nextFreePreRoll === 0
                    ? <span className="text-xs bg-[#c9a84c] text-[#1a1a1a] font-bold px-3 py-1 rounded-full">🎉 Earned!</span>
                    : <span className="text-[#c9a84c] text-xs font-bold">{nextFreePreRoll} away</span>}
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${preRollProgress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-[#555] mt-1">
                  <span>{purchaseCount % 5} of 5 orders</span>
                  <span>{Math.round(preRollProgress)}%</span>
                </div>
              </div>

              {/* FREE EIGHTH */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-bold text-sm">Free Eighth</p>
                    <p className="text-[#666] text-xs">Every 10th purchase</p>
                  </div>
                  {nextFreeEighth === 0
                    ? <span className="text-xs bg-[#c9a84c] text-[#1a1a1a] font-bold px-3 py-1 rounded-full">🎉 Earned!</span>
                    : <span className="text-[#c9a84c] text-xs font-bold">{nextFreeEighth} away</span>}
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${eighthProgress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-[#555] mt-1">
                  <span>{purchaseCount % 10} of 10 orders</span>
                  <span>{Math.round(eighthProgress)}%</span>
                </div>
              </div>
            </div>

            {/* ACTIVE PERKS */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 mb-6">
              <div className="text-xs uppercase tracking-widest text-[#c9a84c] mb-4">Your Active Perks</div>
              <div className="flex flex-col gap-2">
                {[
                  { icon: '⭐', label: '2x points on every order', active: true },
                  { icon: '💸', label: '10% off orders over $50', active: true },
                  { icon: '🎯', label: 'Priority order processing', active: true },
                  { icon: '🎁', label: 'Event invites + surprise gifts', active: true },
                  { icon: '🌿', label: 'Monthly free oz raffle — you\'re entered!', active: true },
                ].map((perk, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <span className="text-lg">{perk.icon}</span>
                    <span className="text-sm text-[#f5f0e8]/80">{perk.label}</span>
                    <span className="ml-auto text-[#c9a84c] text-xs font-bold">Active ✓</span>
                  </div>
                ))}
              </div>
            </div>

            {/* POINTS REWARDS */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 mb-6">
              <div className="text-xs uppercase tracking-widest text-[#c9a84c] mb-4">Points Rewards</div>
              <div className="flex flex-col gap-2">
                <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 100 ? 'border-[#c9a84c]/30 bg-[#c9a84c]/5' : 'border-white/5 bg-white/5'}`}>
                  <div>
                    <p className="font-bold text-sm">Free Pre-Roll or Gram</p>
                    <p className="text-[#666] text-xs">100 points</p>
                  </div>
                  {points >= 100
                    ? <a href="/rewards" className="text-xs bg-[#c9a84c] text-[#1a1a1a] font-bold px-3 py-1.5 rounded-full">Claim →</a>
                    : <span className="text-xs text-[#555] font-bold">{100 - points} pts away</span>}
                </div>
                <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 300 ? 'border-[#c9a84c]/30 bg-[#c9a84c]/5' : 'border-white/5 bg-white/5'}`}>
                  <div>
                    <p className="font-bold text-sm">Free Eighth</p>
                    <p className="text-[#666] text-xs">300 points</p>
                  </div>
                  {points >= 300
                    ? <a href="/rewards" className="text-xs bg-[#c9a84c] text-[#1a1a1a] font-bold px-3 py-1.5 rounded-full">Claim →</a>
                    : <span className="text-xs text-[#555] font-bold">{300 - points} pts away</span>}
                </div>
              </div>
            </div>

            {/* RENEW MEMBERSHIP */}
            <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-2xl p-5 mb-6">
              <div className="text-xs uppercase tracking-widest text-[#c9a84c] mb-2">Renew Membership</div>
              <p className="text-[#999] text-sm mb-4">Keep your House membership active for $25/month. Send via Cash App to stay in the family.</p>
              <a href="https://cash.app/$Luckydayz3" target="_blank" rel="noopener noreferrer"
                className="w-full bg-[#c9a84c] text-[#1a1a1a] font-bold py-3 rounded-xl hover:bg-[#e8c97a] transition-all block text-center">
                💚 Renew via Cash App — $25
              </a>
              <p className="text-[#555] text-xs text-center mt-2">Send to $Luckydayz3 with your name in the note</p>
            </div>

            {/* REFERRAL */}
            {member.referral_code && (
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 mb-6">
                <div className="text-xs uppercase tracking-widest text-[#c9a84c] mb-3">Your Referral Code</div>
                <div className="bg-black/30 rounded-xl p-4 text-center mb-3">
                  <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-[#c9a84c] tracking-widest">{member.referral_code}</div>
                </div>
                <p className="text-[#666] text-xs mb-3">Share your code — you get +50 points for every friend who orders!</p>
                <button onClick={() => {
                  navigator.clipboard.writeText(`Hey! Use my LuckyDayze referral code ${member.referral_code} at lucky-dayze.vercel.app/rewards to get bonus points and a free mini pre-roll! 🌿`)
                  alert('Referral message copied!')
                }} className="w-full border border-white/10 text-[#999] font-bold py-2 rounded-xl text-sm hover:border-[#c9a84c] hover:text-[#c9a84c] transition-all">
                  📋 Copy Referral Message
                </button>
                {member.referral_count > 0 && (
                  <p className="text-center text-xs text-[#c9a84c] font-bold mt-2">🎉 {member.referral_count} successful referral{member.referral_count !== 1 ? 's' : ''}!</p>
                )}
              </div>
            )}

            <div className="text-center">
              <button onClick={() => { setMember(null); setPhone('') }} className="text-[#555] text-sm hover:text-[#999]">← Sign out</button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}