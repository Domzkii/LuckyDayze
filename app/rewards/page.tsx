'use client'

import { useState } from 'react'
import { supabase } from '../supabase'

export default function RewardsPage() {
  
  const [phone, setPhone] = useState('')
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [showHouseForm, setShowHouseForm] = useState(false)
  const [memberForm, setMemberForm] = useState({ name: '', email: '', birthday: '' })
  const [submitted, setSubmitted] = useState(false)
  const [referralChoice, setReferralChoice] = useState<'grabba' | 'vegan' | null>(null)
  const [referralCode, setReferralCode] = useState('')
  const [referralApplied, setReferralApplied] = useState(false)
  const [referralError, setReferralError] = useState('')

  async function lookup() {
    if (!phone) return
    setLoading(true)
    setNotFound(false)
    setCustomer(null)
    const { data } = await supabase
      .from('loyalty')
      .select('*')
      .eq('customer_phone', phone.replace(/\D/g, ''))
      .single()
    setLoading(false)
    if (data) setCustomer(data)
    else setNotFound(true)
  }

  async function submitRequest(tier: string) {
    await supabase.from('membership_requests').insert({
      customer_phone: customer.customer_phone,
      customer_name: memberForm.name || customer.customer_name,
      customer_email: memberForm.email,
      customer_birthday: memberForm.birthday,
      requested_tier: tier,
      status: 'pending'
    })
    await supabase.from('loyalty').update({
      membership_requested: tier,
      email: memberForm.email,
      birthday: memberForm.birthday
    }).eq('customer_phone', customer.customer_phone)
    setSubmitted(true)
    setShowMemberForm(false)
    setShowHouseForm(false)
  }

  async function claimReward(rewardName: string, pointsCost: number, rewardKey: string) {
    const confirmed = window.confirm(`Use ${pointsCost} points to claim: ${rewardName}?\n\nYour points will be deducted immediately and the reward will be added to your cart.`)
    if (!confirmed) return
    if ((customer?.points || 0) < pointsCost) return

    await supabase.from('loyalty').update({
      points: (customer.points || 0) - pointsCost,
      claimed_reward: rewardKey
    }).eq('customer_phone', customer.customer_phone)

    localStorage.setItem('luckydayze_reward', JSON.stringify({
      name: rewardName,
      key: rewardKey,
      phone: customer.customer_phone
    }))

    setCustomer((prev: any) => ({
      ...prev,
      points: (prev.points || 0) - pointsCost,
      claimed_reward: rewardKey
    }))

    window.location.href = '/?reward=claimed'
  }
  async function applyReferralCode() {
    if (!referralCode) return
    setReferralError('')

    // Check if this customer already has a referred_by
    if (customer?.referred_by) {
      setReferralError('You have already used a referral code.')
      return
    }

    // Check if this is their first order
    if ((customer?.purchase_count || 0) > 0) {
      setReferralError('Referral codes can only be used before your first order.')
      return
    }

    // Find the referrer
    const { data: referrer } = await supabase
      .from('loyalty')
      .select('*')
      .eq('referral_code', referralCode.toUpperCase())
      .single()

    if (!referrer) {
      setReferralError('Invalid referral code. Please check and try again.')
      return
    }

    if (referrer.customer_phone === customer.customer_phone) {
      setReferralError('You cannot use your own referral code.')
      return
    }

    // Save referral to customer
    await supabase.from('loyalty').update({
      referred_by: referralCode.toUpperCase(),
      points: (customer.points || 0) + 25
    }).eq('customer_phone', customer.customer_phone)

    // Save reward choice to localStorage for store
    if (referralChoice) {
      localStorage.setItem('luckydayze_referral_reward', JSON.stringify({
        type: referralChoice === 'grabba' ? 'Mini Grabba Pre-Roll' : 'Mini Pre-Roll',
        key: 'referral_preroll'
      }))
    }

    setReferralApplied(true)
    setCustomer((prev: any) => ({ ...prev, referred_by: referralCode.toUpperCase(), points: (prev.points || 0) + 25 }))
  }

  const purchaseCount = customer?.purchase_count || 0
  const points = customer?.points || 0
  const tier = customer?.membership_tier || 'guest'
  const isEligibleForMember = purchaseCount >= 3 && tier === 'guest' && !customer?.membership_requested
  const isEligibleForHouse = tier === 'member' && purchaseCount >= 6 && points >= 500 && !customer?.membership_requested
  const nextFreePreRoll = tier === 'house' ? 5 - (purchaseCount % 5) : null
  const nextFreeEighth = tier === 'house' ? 10 - (purchaseCount % 10) : null

  const tierColors: Record<string, string> = {
    guest: 'bg-gray-100 text-gray-600',
    member: 'bg-green-100 text-green-700',
    house: 'bg-[#1a1a1a] text-[#c9a84c]'
  }
  const tierLabel: Record<string, string> = {
    guest: 'Guest',
    member: 'Member',
    house: 'The House'
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]/10 sticky top-0 bg-[#f5f0e8]/95 backdrop-blur z-40">
        <div>
          <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold tracking-wider">LUCKY DAYZE</div>
          <div className="text-xs tracking-widest uppercase text-[#999]">Lucky Rewards</div>
        </div>
        <a href="/" className="border border-[#1a1a1a]/20 text-[#666] text-sm font-bold px-4 py-2 rounded-full hover:border-[#1a1a1a] transition-all">Store</a>
      </nav>

      <div className="max-w-md mx-auto px-6 py-10">
        {!customer ? (
          <>
            <h1 style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-2">Lucky Rewards</h1>
            <p className="text-[#888] text-sm mb-8">Enter your phone number to check your points and membership status.</p>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-10">
              <input type="tel" placeholder="Your phone number" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lookup() }} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]" />
              {notFound && <p className="text-red-500 text-xs mb-3">No account found. Place your first order to join Lucky Rewards!</p>}
              <button onClick={lookup} disabled={loading} className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all disabled:opacity-50">
                {loading ? 'Looking up...' : 'Check My Rewards'}
              </button>
            </div>

            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-4">Membership Tiers</h2>
            <div className="flex flex-col gap-3">
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg">Guest</span>
                  <span className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full">Free — Auto</span>
                </div>
                <p className="text-[#888] text-xs mb-3">Everyone starts here automatically on their first purchase.</p>
                <div className="flex flex-col gap-1 text-xs text-[#666]">
                  <span>✓ 1 point per $1 spent</span>
                  <span>✓ 100 points = free gram or pre-roll (pickup only)</span>
                </div>
              </div>
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg text-green-700">Member</span>
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">Free — 3+ orders</span>
                </div>
                <p className="text-[#888] text-xs mb-3">Opt in after 3 purchases. We review and approve each application.</p>
                <div className="flex flex-col gap-1 text-xs text-[#666]">
                  <span>✓ 2x points on orders $50+</span>
                  <span>✓ 100 points = free pre-roll or gram</span>
                  <span>✓ 300 points = free eighth</span>
                  <span>✓ Unlock House eligibility at 500 points</span>
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg text-[#c9a84c]">The House</span>
                  <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-3 py-1 rounded-full">$25/month</span>
                </div>
                <p className="text-[#999] text-xs mb-3">Member + 6 purchases + 500 points to unlock.</p>
                <div className="flex flex-col gap-1 text-xs text-[#f5f0e8]/70">
                  <span>✓ 2x points always</span>
                  <span>✓ 10% off all orders over $50</span>
                  <span>✓ Free pre-roll every 5th purchase</span>
                  <span>✓ Free eighth every 10th purchase</span>
                  <span>✓ Priority order processing</span>
                  <span>✓ Event invites + surprise gifts</span>
                  <span>✓ Monthly free oz raffle</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold">Hey, {customer.customer_name}!</h1>
                <p className="text-[#999] text-sm">{customer.customer_phone}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${tierColors[tier]}`}>{tierLabel[tier]}</span>
            </div>

            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-4">
              <div className="text-xs uppercase tracking-wider text-[#999] mb-2">Your Points</div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-4xl font-bold text-[#c9a84c] mb-1">{points}</div>
              <p className="text-[#999] text-xs mb-4">{purchaseCount} total purchase{purchaseCount !== 1 ? 's' : ''}</p>

              {tier === 'guest' && (
                <div className="flex flex-col gap-2">
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 100 ? 'border-green-200 bg-green-50' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">Free Gram or Pre-Roll</div>
                      <div className="text-xs text-[#999]">100 points · Pickup only</div>
                    </div>
                    {points >= 100
                      ? <button onClick={() => claimReward('Free Pre-Roll (Pickup)', 100, 'free_preroll')} className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-green-700 transition-all">Claim →</button>
                      : <span className="text-xs text-[#999] font-bold">{100 - points} pts away</span>}
                  </div>
                </div>
              )}

              {tier === 'member' && (
                <div className="flex flex-col gap-2">
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 100 ? 'border-green-200 bg-green-50' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">Free Pre-Roll or Gram</div>
                      <div className="text-xs text-[#999]">100 points</div>
                    </div>
                    {points >= 100
                      ? <button onClick={() => claimReward('Free Pre-Roll', 100, 'free_preroll')} className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-green-700 transition-all">Claim →</button>
                      : <span className="text-xs text-[#999] font-bold">{100 - points} pts away</span>}
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 300 ? 'border-green-200 bg-green-50' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">Free Eighth</div>
                      <div className="text-xs text-[#999]">300 points</div>
                    </div>
                    {points >= 300
                      ? <button onClick={() => claimReward('Free Eighth', 300, 'free_eighth')} className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-green-700 transition-all">Claim →</button>
                      : <span className="text-xs text-[#999] font-bold">{300 - points} pts away</span>}
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 500 && purchaseCount >= 6 ? 'border-[#c9a84c] bg-[#f5f0e8]' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">Unlock The House</div>
                      <div className="text-xs text-[#999]">500 points + 6 purchases</div>
                    </div>
                    {points >= 500 && purchaseCount >= 6
                      ? <span className="text-xs bg-[#c9a84c] text-[#1a1a1a] font-bold px-3 py-1 rounded-full">Unlocked!</span>
                      : <span className="text-xs text-[#999] font-bold">{Math.max(0, 500 - points)} pts · {Math.max(0, 6 - purchaseCount)} orders</span>}
                  </div>
                </div>
              )}

              {tier === 'house' && (
                <div className="flex flex-col gap-2">
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 100 ? 'border-green-200 bg-green-50' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">Free Pre-Roll or Gram</div>
                      <div className="text-xs text-[#999]">100 points</div>
                    </div>
                    {points >= 100
                      ? <button onClick={() => claimReward('Free Pre-Roll', 100, 'free_preroll')} className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-green-700 transition-all">Claim →</button>
                      : <span className="text-xs text-[#999] font-bold">{100 - points} pts away</span>}
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 300 ? 'border-green-200 bg-green-50' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">Free Eighth</div>
                      <div className="text-xs text-[#999]">300 points</div>
                    </div>
                    {points >= 300
                      ? <button onClick={() => claimReward('Free Eighth', 300, 'free_eighth')} className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-green-700 transition-all">Claim →</button>
                      : <span className="text-xs text-[#999] font-bold">{300 - points} pts away</span>}
                  </div>
                </div>
              )}
            </div>

            {tier === 'house' && (
              <div className="bg-[#1a1a1a] rounded-2xl p-5 mb-4">
                <div className="text-xs uppercase tracking-wider text-[#c9a84c] mb-3">House Perks</div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">10% Off Orders $50+</div>
                      <div className="text-xs text-[#999]">Applied automatically</div>
                    </div>
                    <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-3 py-1 rounded-full">Active ✓</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Free Pre-Roll</div>
                      <div className="text-xs text-[#999]">Every 5th purchase</div>
                    </div>
                    <span className="text-xs text-[#c9a84c] font-bold">{nextFreePreRoll} order{nextFreePreRoll !== 1 ? 's' : ''} away</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Free Eighth</div>
                      <div className="text-xs text-[#999]">Every 10th purchase</div>
                    </div>
                    <span className="text-xs text-[#c9a84c] font-bold">{nextFreeEighth} order{nextFreeEighth !== 1 ? 's' : ''} away</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Priority Processing</div>
                      <div className="text-xs text-[#999]">Your orders confirmed first</div>
                    </div>
                    <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-3 py-1 rounded-full">Active ✓</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Event Invites + Surprise Gifts</div>
                      <div className="text-xs text-[#999]">Lighters, cannabis kits & more</div>
                    </div>
                    <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-3 py-1 rounded-full">Active ✓</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Free Oz Raffle</div>
                      <div className="text-xs text-[#999]">Monthly giveaway</div>
                    </div>
                    <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-3 py-1 rounded-full">Entered ✓</span>
                  </div>
                </div>
                {customer.house_paid_until && (
                  <div className="mt-4 pt-4 border-t border-white/10 text-xs text-[#999] text-center">
                    Membership active until {customer.house_paid_until}
                  </div>
                )}
              </div>
            )}

            {isEligibleForMember && !submitted && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
                <div className="font-bold text-green-700 mb-1">🎉 You're eligible for Member status!</div>
                <p className="text-green-600 text-sm mb-3">You've made {purchaseCount} purchases. Upgrade for 2x points on big orders, free pre-rolls, and a path to The House — completely free.</p>
                <button onClick={() => setShowMemberForm(true)} className="bg-green-700 text-white font-bold px-6 py-2 rounded-full text-sm hover:bg-green-800 transition-all">
                  Apply for Member →
                </button>
              </div>
            )}

            {isEligibleForHouse && !submitted && (
              <div className="bg-[#1a1a1a] rounded-2xl p-5 mb-4">
                <div className="font-bold text-[#c9a84c] mb-1">👑 You're invited to The House</div>
                <p className="text-[#999] text-sm mb-3">You've earned your spot with {purchaseCount} purchases and {points} points. Join The House for $25/month and unlock our best perks.</p>
                <button onClick={() => setShowHouseForm(true)} className="bg-[#c9a84c] text-[#1a1a1a] font-bold px-6 py-2 rounded-full text-sm hover:bg-[#e8c97a] transition-all">
                  Join The House →
                </button>
              </div>
            )}

            {submitted && (
              <div className="bg-white border border-[#c9a84c] rounded-2xl p-5 mb-4">
                <div className="font-bold text-[#c9a84c] mb-1">✓ Request submitted!</div>
                <p className="text-[#888] text-sm">We'll reach out personally to confirm your membership. Welcome to the family.</p>
              </div>
            )}

            {customer.membership_requested && !submitted && (
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4 mb-4">
                <p className="text-[#888] text-sm">✓ Membership request pending — we'll be in touch shortly.</p>
              </div>
            )}

            <div className="text-center mt-4">
              <button onClick={() => { setCustomer(null); setPhone(''); setSubmitted(false) }} className="text-[#999] text-sm hover:text-[#1a1a1a]">
                {/* REFERRAL SECTION */}
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-4">
              <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Your Referral Code</div>
              <div className="bg-[#f5f0e8] rounded-xl p-4 text-center mb-3">
                <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-[#c9a84c] tracking-widest mb-1">
                  {customer.referral_code || '——'}
                </div>
                <p className="text-xs text-[#999]">Share this code with friends</p>
              </div>
              <p className="text-xs text-[#666] mb-3">When a friend uses your code they get <span className="font-bold">+25 bonus points</span> and a <span className="font-bold">free mini pre-roll</span>. You get <span className="font-bold">+50 points</span> when they place their first order.</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Hey! Use my LuckyDayze referral code ${customer.referral_code} at lucky-dayze.vercel.app/rewards to get bonus points and a free mini pre-roll on your first order! 🌿`)
                  alert('Referral message copied to clipboard!')
                }}
                className="w-full border border-[#c9a84c] text-[#c9a84c] font-bold py-2 rounded-xl text-sm hover:bg-[#c9a84c]/5 transition-all"
              >
                📋 Copy Referral Message
              </button>
              {customer.referral_count > 0 && (
                <p className="text-xs text-green-600 font-bold text-center mt-2">🎉 {customer.referral_count} successful referral{customer.referral_count !== 1 ? 's' : ''}!</p>
              )}
            </div>

            {/* USE A REFERRAL CODE */}
            {!customer.referred_by && (customer.purchase_count || 0) === 0 && (
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-4">
                <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Have a Referral Code?</div>
                {!referralApplied ? (
                  <>
                    <p className="text-xs text-[#666] mb-3">Enter a friend's code to get <span className="font-bold">+25 bonus points</span> and a <span className="font-bold">free mini pre-roll</span> on your first order!</p>
                    <div className="flex flex-col gap-2 mb-3">
                      <div
                        onClick={() => setReferralChoice('grabba')}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${referralChoice === 'grabba' ? 'border-[#c9a84c] bg-[#c9a84c]/5' : 'border-[#e0d9cc]'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${referralChoice === 'grabba' ? 'border-[#c9a84c]' : 'border-[#ccc]'}`}>
                          {referralChoice === 'grabba' && <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />}
                        </div>
                        <span className="text-sm font-bold">😮‍💨 Mini Grabba Pre-Roll</span>
                      </div>
                      <div
                        onClick={() => setReferralChoice('vegan')}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${referralChoice === 'vegan' ? 'border-[#c9a84c] bg-[#c9a84c]/5' : 'border-[#e0d9cc]'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${referralChoice === 'vegan' ? 'border-[#c9a84c]' : 'border-[#ccc]'}`}>
                          {referralChoice === 'vegan' && <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />}
                        </div>
                        <span className="text-sm font-bold">🥹 Mini Pre-Roll (Vegan)</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter referral code"
                      value={referralCode}
                      onChange={e => setReferralCode(e.target.value.toUpperCase())}
                      className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-2 outline-none focus:border-[#c9a84c] placeholder-[#bbb] font-mono tracking-widest"
                    />
                    {referralError && <p className="text-red-500 text-xs mb-2">{referralError}</p>}
                    <button
                      onClick={applyReferralCode}
                      disabled={!referralChoice || !referralCode}
                      className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all disabled:opacity-50"
                    >
                      Apply Code
                    </button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="text-3xl mb-2">🎉</div>
                    <p className="font-bold text-green-700 mb-1">Referral applied!</p>
                    <p className="text-xs text-[#888]">+25 points added. Your free mini pre-roll will be added to your first order automatically.</p>
                  </div>
                )}
              </div>
            )}

            {customer.referred_by && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
                <p className="text-green-700 text-sm font-bold">✓ Referral code applied — {customer.referred_by}</p>
                <p className="text-green-600 text-xs mt-1">Your free mini pre-roll will be added to your first order!</p>
              </div>
            )}
                ← Look up different number
              </button>
            </div>
          </>
        )}
      </div>

      {(showMemberForm || showHouseForm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowMemberForm(false); setShowHouseForm(false) }} />
          <div className="relative w-full max-w-sm bg-[#f5f0e8] border border-[#e0d9cc] rounded-2xl p-6">
            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-1">
              {showHouseForm ? 'Join The House' : 'Apply for Member'}
            </h2>
            <p className="text-[#999] text-sm mb-6">We review every application personally and will reach out to confirm.</p>
            <input type="text" placeholder="Full name" value={memberForm.name} onChange={e => setMemberForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-white border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]" />
            <input type="email" placeholder="Email address" value={memberForm.email} onChange={e => setMemberForm(prev => ({ ...prev, email: e.target.value }))} className="w-full bg-white border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]" />
            <input type="text" placeholder="Birthday (MM/DD)" value={memberForm.birthday} onChange={e => setMemberForm(prev => ({ ...prev, birthday: e.target.value }))} className="w-full bg-white border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-[#c9a84c] placeholder-[#bbb]" />
            {showHouseForm && (
              <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
                <p className="text-[#c9a84c] font-bold text-sm mb-1">House Membership — $25/month</p>
                <p className="text-[#999] text-xs">Send $25 to <span className="text-[#c9a84c] font-bold">$Luckydayz3</span> on Cash App with your name in the note. We'll activate your membership within 24 hours.</p>
              </div>
            )}
            <button onClick={() => submitRequest(showHouseForm ? 'house' : 'member')} className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all">
              {showHouseForm ? 'Submit & Send Payment' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}