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
    if (data) {
      setCustomer(data)
    } else {
      setNotFound(true)
    }
  }

  async function submitMemberRequest(tier: string) {
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

  const purchaseCount = customer?.purchase_count || 0
  const points = customer?.points || 0
  const tier = customer?.membership_tier || 'guest'
  const isEligibleForMember = purchaseCount >= 3 && tier === 'guest' && !customer?.membership_requested
  const isEligibleForHouse = purchaseCount >= 6 && tier === 'member' && !customer?.membership_requested
  const nextFreePreRoll = tier === 'house'
    ? 2 - (purchaseCount % 2)
    : tier === 'member'
    ? 5 - (purchaseCount % 5)
    : null
  const nextFreeEighth = tier === 'house'
    ? 5 - (purchaseCount % 5)
    : tier === 'member'
    ? 10 - (purchaseCount % 10)
    : null

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
            <p className="text-[#888] text-sm mb-8">Enter your phone number to check your points, perks, and membership status.</p>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6">
              <input
                type="tel"
                placeholder="Your phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') lookup() }}
                className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]"
              />
              {notFound && <p className="text-red-500 text-xs mb-3">No account found. Place your first order to join Lucky Rewards!</p>}
              <button onClick={lookup} disabled={loading} className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all disabled:opacity-50">
                {loading ? 'Looking up...' : 'Check My Rewards'}
              </button>
            </div>

            {/* TIER OVERVIEW */}
            <div className="mt-10">
              <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-4">Membership Tiers</h2>
              <div className="flex flex-col gap-3">
                <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg">Guest</span>
                    <span className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full">Free</span>
                  </div>
                  <p className="text-[#888] text-sm mb-3">Earn 1 point per $1 spent</p>
                  <div className="text-xs text-[#666] flex flex-col gap-1">
                    <span>✓ 100 points = free pre-roll</span>
                    <span>✓ 200 points = $10 off</span>
                  </div>
                </div>
                <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg text-green-700">Member</span>
                    <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">Free — 3+ orders</span>
                  </div>
                  <p className="text-[#888] text-sm mb-3">Opt-in after your 3rd purchase</p>
                  <div className="text-xs text-[#666] flex flex-col gap-1">
                    <span>✓ Free delivery on every order</span>
                    <span>✓ Free pre-roll every 5th purchase</span>
                    <span>✓ Free eighth every 10th purchase</span>
                    <span>✓ Priority service</span>
                  </div>
                </div>
                <div className="bg-[#1a1a1a] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg text-[#c9a84c]">The House</span>
                    <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-3 py-1 rounded-full">$20/month</span>
                  </div>
                  <p className="text-[#999] text-sm mb-3">6+ Member purchases or 2 referrals</p>
                  <div className="text-xs text-[#f5f0e8]/70 flex flex-col gap-1">
                    <span>✓ Free pre-roll every 2nd purchase</span>
                    <span>✓ Free eighth every 5th purchase</span>
                    <span>✓ Event invites</span>
                    <span>✓ Surprise gifts — lighters, cannabis kits</span>
                    <span>✓ Chance to win a free oz</span>
                    <span>✓ Direct concierge contact</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* CUSTOMER DASHBOARD */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold">Hey, {customer.customer_name}!</h1>
                <p className="text-[#999] text-sm">{customer.customer_phone}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${tierColors[tier]}`}>
                {tierLabel[tier]}
              </span>
            </div>

            {/* MEMBER ELIGIBLE BANNER */}
            {isEligibleForMember && !submitted && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5">
                <div className="font-bold text-green-700 mb-1">🎉 You're eligible for Member status!</div>
                <p className="text-green-600 text-sm mb-3">You've made {purchaseCount} purchases. Upgrade for free delivery, free pre-rolls every 5th order, and more — completely free.</p>
                <button onClick={() => setShowMemberForm(true)} className="bg-green-700 text-white font-bold px-6 py-2 rounded-full text-sm hover:bg-green-800 transition-all">
                  Become a Member →
                </button>
              </div>
            )}

            {/* HOUSE ELIGIBLE BANNER */}
            {isEligibleForHouse && !submitted && (
              <div className="bg-[#1a1a1a] rounded-2xl p-5 mb-5">
                <div className="font-bold text-[#c9a84c] mb-1">👑 You're invited to The House</div>
                <p className="text-[#f5f0e8]/70 text-sm mb-3">You've earned your spot. Join The House for $20/month and unlock our best perks — free pre-rolls every 2nd order, free eighths, event invites, and more.</p>
                <button onClick={() => setShowHouseForm(true)} className="bg-[#c9a84c] text-[#1a1a1a] font-bold px-6 py-2 rounded-full text-sm hover:bg-[#e8c97a] transition-all">
                  Join The House →
                </button>
              </div>
            )}

            {submitted && (
              <div className="bg-[#f5f0e8] border border-[#c9a84c] rounded-2xl p-5 mb-5">
                <div className="font-bold text-[#c9a84c] mb-1">✓ Request submitted!</div>
                <p className="text-[#888] text-sm">We'll reach out to you personally to confirm your membership. Welcome to the family.</p>
              </div>
            )}

            {customer.membership_requested && !submitted && (
              <div className="bg-[#f5f0e8] border border-[#e0d9cc] rounded-2xl p-4 mb-5">
                <p className="text-[#888] text-sm">✓ Membership request pending — we'll be in touch shortly.</p>
              </div>
            )}

            {/* POINTS (GUEST ONLY) */}
            {tier === 'guest' && (
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-4">
                <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Your Points</div>
                <div style={{fontFamily: 'Georgia, serif'}} className="text-4xl font-bold text-[#c9a84c] mb-1">{points}</div>
                <p className="text-[#999] text-xs mb-4">points earned</p>
                <div className="flex flex-col gap-2">
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 100 ? 'border-green-200 bg-green-50' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">Free Pre-Roll</div>
                      <div className="text-xs text-[#999]">100 points</div>
                    </div>
                    {points >= 100 ? <span className="text-xs bg-green-600 text-white font-bold px-3 py-1 rounded-full">Redeem</span> : <span className="text-xs text-[#999]">{100 - points} pts away</span>}
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${points >= 200 ? 'border-green-200 bg-green-50' : 'border-[#e0d9cc] bg-[#f5f0e8]'}`}>
                    <div>
                      <div className="font-bold text-sm">$10 Off Your Order</div>
                      <div className="text-xs text-[#999]">200 points</div>
                    </div>
                    {points >= 200 ? <span className="text-xs bg-green-600 text-white font-bold px-3 py-1 rounded-full">Redeem</span> : <span className="text-xs text-[#999]">{200 - points} pts away</span>}
                  </div>
                </div>
              </div>
            )}

            {/* MEMBER PERKS */}
            {tier === 'member' && (
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-4">
                <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Member Perks</div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center p-3 bg-[#f5f0e8] rounded-xl">
                    <div>
                      <div className="font-bold text-sm">Free Delivery</div>
                      <div className="text-xs text-[#999]">Every order</div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">Active ✓</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#f5f0e8] rounded-xl">
                    <div>
                      <div className="font-bold text-sm">Free Pre-Roll</div>
                      <div className="text-xs text-[#999]">Every 5th purchase</div>
                    </div>
                    <span className="text-xs text-[#999] font-bold">{nextFreePreRoll} order{nextFreePreRoll !== 1 ? 's' : ''} away</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#f5f0e8] rounded-xl">
                    <div>
                      <div className="font-bold text-sm">Free Eighth</div>
                      <div className="text-xs text-[#999]">Every 10th purchase</div>
                    </div>
                    <span className="text-xs text-[#999] font-bold">{nextFreeEighth} order{nextFreeEighth !== 1 ? 's' : ''} away</span>
                  </div>
                </div>
              </div>
            )}

            {/* HOUSE PERKS */}
            {tier === 'house' && (
              <div className="bg-[#1a1a1a] rounded-2xl p-5 mb-4">
                <div className="text-xs uppercase tracking-wider text-[#c9a84c] mb-3">House Perks</div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Free Pre-Roll</div>
                      <div className="text-xs text-[#999]">Every 2nd purchase</div>
                    </div>
                    <span className="text-xs text-[#c9a84c] font-bold">{nextFreePreRoll} order{nextFreePreRoll !== 1 ? 's' : ''} away</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Free Eighth</div>
                      <div className="text-xs text-[#999]">Every 5th purchase</div>
                    </div>
                    <span className="text-xs text-[#c9a84c] font-bold">{nextFreeEighth} order{nextFreeEighth !== 1 ? 's' : ''} away</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Event Invites</div>
                      <div className="text-xs text-[#999]">Exclusive access</div>
                    </div>
                    <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-3 py-1 rounded-full">Active ✓</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="font-bold text-sm text-[#f5f0e8]">Surprise Gifts</div>
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

            <div className="text-center mt-4">
              <p className="text-[#999] text-xs mb-3">{purchaseCount} total purchase{purchaseCount !== 1 ? 's' : ''}</p>
              <button onClick={() => { setCustomer(null); setPhone(''); setSubmitted(false) }} className="text-[#999] text-sm hover:text-[#1a1a1a]">
                ← Look up different number
              </button>
            </div>
          </>
        )}
      </div>

      {/* MEMBER OPT-IN FORM */}
      {(showMemberForm || showHouseForm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowMemberForm(false); setShowHouseForm(false) }} />
          <div className="relative w-full max-w-sm bg-[#f5f0e8] border border-[#e0d9cc] rounded-2xl p-6">
            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-1">
              {showHouseForm ? 'Join The House' : 'Become a Member'}
            </h2>
            <p className="text-[#999] text-sm mb-6">We'll reach out personally to confirm your membership.</p>
            <input
              type="text"
              placeholder="Full name"
              value={memberForm.name}
              onChange={e => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-white border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]"
            />
            <input
              type="email"
              placeholder="Email address"
              value={memberForm.email}
              onChange={e => setMemberForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full bg-white border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]"
            />
            <input
              type="text"
              placeholder="Birthday (MM/DD)"
              value={memberForm.birthday}
              onChange={e => setMemberForm(prev => ({ ...prev, birthday: e.target.value }))}
              className="w-full bg-white border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-6 outline-none focus:border-[#c9a84c] placeholder-[#bbb]"
            />
            {showHouseForm && (
              <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4 text-sm">
                <p className="text-[#c9a84c] font-bold mb-1">House Membership — $20/month</p>
                <p className="text-[#999] text-xs">Send $20 to <span className="text-[#c9a84c] font-bold">$Luckydayz3</span> on Cash App with your name in the note. We'll activate your membership within 24 hours.</p>
              </div>
            )}
            <button
              onClick={() => submitMemberRequest(showHouseForm ? 'house' : 'member')}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all"
            >
              {showHouseForm ? 'Submit & Send Payment' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}