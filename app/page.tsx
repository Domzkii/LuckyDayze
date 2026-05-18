'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useTheme } from './theme'

const WEIGHT_LABELS: Record<string, string> = {
  '3.5': '1/8', '7': '1/4', '14': '1/2', '28': '1oz'
}

export default function Home() {
  const { theme, toggle } = useTheme()
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [finalTotal, setFinalTotal] = useState(0)
  const [ageVerified, setAgeVerified] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery')
  const [selectedWeights, setSelectedWeights] = useState<Record<string, {weight: string, qty: number}>>({})
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  // Referral state
  const [checkoutReferral, setCheckoutReferral] = useState('')
  const [checkoutReferralChoice, setCheckoutReferralChoice] = useState<'grabba' | 'vegan' | 'later' | null>(null)
  const [checkoutReferralValid, setCheckoutReferralValid] = useState(false)
  const [checkoutReferralError, setCheckoutReferralError] = useState('')
  const [checkoutReferralChecked, setCheckoutReferralChecked] = useState(false)

  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase.from('products').select('*')
      setProducts(data || [])
    }
    loadProducts()

    // Install prompt
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    const isAndroid = /android/.test(navigator.userAgent.toLowerCase())
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const hasSeenPrompt = localStorage.getItem('ld_install_prompt')
    if ((isIOS || isAndroid) && !isStandalone && !hasSeenPrompt) {
      setTimeout(() => setShowInstallPrompt(true), 3000)
    }

    // Claimed reward from rewards page
    const rewardRaw = localStorage.getItem('luckydayze_reward')
    if (rewardRaw) {
      try {
        const reward = JSON.parse(rewardRaw)
        setCart([{
          id: 'reward_' + reward.key,
          name: reward.name,
          price: 0, qty: 1,
          emoji: '🎁',
          category: reward.key === 'free_eighth' ? 'Flower' : 'Pre-Rolls',
          isReward: true,
          rewardPhone: reward.phone
        }])
        setCartOpen(true)
        localStorage.removeItem('luckydayze_reward')
      } catch (e) {}
    }
  }, [])

  // ── PRE-ROLL PRICING ──────────────────────────────────────────
  function applyPreRollPricing(cart: any[]) {
    const regularPreRolls = cart.filter((i: any) => i.category === 'Pre-Rolls' && !i.isReward && (i.originalPrice || i.price) >= 15)
    const miniPreRolls = cart.filter((i: any) => i.category === 'Pre-Rolls' && !i.isReward && (i.originalPrice || i.price) < 15)
    const totalRegular = regularPreRolls.reduce((sum: number, i: any) => sum + i.qty, 0)
    const totalMini = miniPreRolls.reduce((sum: number, i: any) => sum + i.qty, 0)
    const totalRegularCost = (Math.floor(totalRegular / 2) * 25) + (totalRegular % 2 * 15)
    const totalMiniCost = (Math.floor(totalMini / 2) * 15) + (totalMini % 2 * 10)

    return cart.map((i: any) => {
      if (i.category !== 'Pre-Rolls' || i.isReward) return i
      const isMini = (i.originalPrice || i.price) < 15
      const group = isMini ? miniPreRolls : regularPreRolls
      const totalCost = isMini ? totalMiniCost : totalRegularCost
      const totalQty = group.reduce((sum: number, p: any) => sum + p.qty, 0)
      const totalCount = isMini ? totalMini : totalRegular
      if (totalQty === 0) return i
      const isFirst = group[0]?.id === i.id
      const promo = totalCount >= 2 ? (isMini ? '2 for $15' : '2 for $25') : null
      if (isFirst) {
        const otherCost = group.filter((p: any) => p.id !== i.id).reduce((sum: number, p: any) => sum + Math.floor((p.qty / totalQty) * totalCost), 0)
        return { ...i, price: (totalCost - otherCost) / i.qty, promo }
      } else {
        return { ...i, price: Math.floor((i.qty / totalQty) * totalCost) / i.qty, promo }
      }
    })
  }

  // ── CART FUNCTIONS ────────────────────────────────────────────
  function addToCart(product: any) {
    setCart((prev: any[]) => {
      const qty = product.qty_override || 1
      const existing = prev.find((i: any) => i.id === product.id && i.name === product.name)
      const newCart = existing
        ? prev.map((i: any) => i.id === product.id && i.name === product.name ? { ...i, qty: i.qty + qty } : i)
        : [...prev, { ...product, qty, originalPrice: product.price }]
      return applyPreRollPricing(newCart)
    })
  }

  function removeFromCart(id: any, itemName?: string) {
    setCart((prev: any[]) => applyPreRollPricing(prev.filter((i: any) => !(i.id === id && i.name === itemName))))
  }

  function changeQty(id: any, delta: any, itemName?: string) {
    setCart((prev: any[]) => {
      const newCart = prev.map((i: any) => {
        if (i.id !== id || i.name !== itemName) return i
        const newQty = i.qty + delta
        if (newQty < 1) return null
        return { ...i, qty: newQty }
      }).filter(Boolean)
      return applyPreRollPricing(newCart)
    })
  }

  const total = cart.reduce((sum: number, i: any) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum: number, i: any) => sum + i.qty, 0)

  // ── REFERRAL CODE CHECK ───────────────────────────────────────
  async function checkReferralCode() {
    if (!checkoutReferral) return
    setCheckoutReferralError('')
    const { data: referrer } = await supabase
      .from('loyalty')
      .select('referral_code, customer_phone')
      .eq('referral_code', checkoutReferral.toUpperCase())
      .maybeSingle()
    if (!referrer) {
      setCheckoutReferralError('Invalid code. Please check and try again.')
      setCheckoutReferralValid(false)
    } else if (referrer.customer_phone === phone.replace(/\D/g, '')) {
      setCheckoutReferralError('You cannot use your own referral code.')
      setCheckoutReferralValid(false)
    } else {
      setCheckoutReferralValid(true)
      setCheckoutReferralChecked(true)
    }
  }

  // ── PLACE ORDER ───────────────────────────────────────────────
  async function placeOrder() {
    if (!name || !phone) { alert('Please fill in your name and phone number.'); return }
    if (deliveryMethod === 'delivery' && !address) { alert('Please fill in your delivery address.'); return }
    if (deliveryMethod === 'delivery' && total < 25) { alert('Minimum order for delivery is $25. Add more items or select pickup!'); return }

    setLoading(true)
    const orderItems = cart.map((i: any) => ({
      id: i.id, name: i.name, price: i.price, qty: i.qty,
      emoji: i.emoji, category: i.category, grams: i.grams
    }))

    // Insert order
    const { error } = await supabase.from('orders').insert({
      customer_name: name,
      customer_phone: phone,
      customer_address: deliveryMethod === 'delivery' ? address : 'PICKUP',
      order_notes: notes,
      items: orderItems,
      total,
      status: 'pending_payment',
      referral_code: checkoutReferralValid ? checkoutReferral.toUpperCase() : null,
      referral_reward: checkoutReferralValid && checkoutReferralChoice
        ? checkoutReferralChoice === 'grabba' ? 'Mini Grabba Pre-Roll'
        : checkoutReferralChoice === 'vegan' ? 'Mini Pre-Roll (Vegan)'
        : 'Claim Later'
        : null
    })

    if (error) { setLoading(false); alert('Something went wrong: ' + error.message); return }

    // Create loyalty profile for new customers
    const cleanPhone = phone.replace(/\D/g, '')
    const { data: existingLoyalty } = await supabase
      .from('loyalty')
      .select('*')
      .eq('customer_phone', cleanPhone)
      .maybeSingle()

    if (!existingLoyalty) {
      const bonusPoints = checkoutReferralValid ? 50 : 25
      const pendingReward = checkoutReferralValid && checkoutReferralChoice === 'later'
        ? 'Mini Grabba Pre-Roll'
        : checkoutReferralValid && checkoutReferralChoice === 'grabba'
        ? 'Mini Grabba Pre-Roll'
        : checkoutReferralValid && checkoutReferralChoice === 'vegan'
        ? 'Mini Pre-Roll (Vegan)'
        : null

      await supabase.from('loyalty').insert({
        customer_phone: cleanPhone,
        customer_name: name,
        purchase_count: 0,
        total_spent: 0,
        points: bonusPoints,
        membership_tier: 'guest',
        membership_status: 'active',
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        referred_by: checkoutReferralValid ? checkoutReferral.toUpperCase() : null,
        pending_referral_reward: checkoutReferralChoice === 'later' ? pendingReward : null
      })

      // Add to cart immediately if they chose grabba or vegan
      if (checkoutReferralValid && checkoutReferralChoice && checkoutReferralChoice !== 'later') {
        localStorage.setItem('luckydayze_referral_reward', JSON.stringify({
          name: checkoutReferralChoice === 'grabba' ? 'Mini Grabba Pre-Roll' : 'Mini Pre-Roll',
          key: 'referral_preroll'
        }))
      }
    }

    setLoading(false)
    setFinalTotal(total)
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: name, customerPhone: phone, customerAddress: address, total, items: orderItems })
    })
    setCart([])
    setCheckoutOpen(false)
    setOrderPlaced(true)
  }

  // ── THEME HELPERS ─────────────────────────────────────────────
  const dark = theme === 'dark'
  const bg = dark ? 'bg-[#0f0f0f]' : 'bg-[#f5f0e8]'
  const bg2 = dark ? 'bg-[#1a1a1a]' : 'bg-white'
  const bg3 = dark ? 'bg-[#222]' : 'bg-[#f0ebe0]'
  const text = dark ? 'text-[#f5f0e8]' : 'text-[#1a1a1a]'
  const text2 = dark ? 'text-[#aaa]' : 'text-[#666]'
  const text3 = dark ? 'text-[#777]' : 'text-[#999]'
  const border = dark ? 'border-[#333]' : 'border-[#e0d9cc]'
  const borderHover = dark ? 'hover:border-[#555]' : 'hover:border-[#c9a84c]'
  const input = dark ? 'bg-[#222] border-[#444] text-[#f5f0e8] placeholder-[#555]' : 'bg-[#f5f0e8] border-[#e0d9cc] text-[#1a1a1a] placeholder-[#bbb]'

  // ── AGE GATE ──────────────────────────────────────────────────
  if (!ageVerified) {
    return (
      <main className={`min-h-screen flex flex-col items-center justify-center px-6 text-center transition-colors ${dark ? 'bg-[#0f0f0f] text-[#f5f0e8]' : 'bg-[#f5f0e8] text-[#1a1a1a]'}`}>
        <div className="text-5xl mb-4">🌿</div>
        <div style={{fontFamily: 'Georgia, serif'}} className="text-4xl font-bold mb-1">LUCKY DAYZE</div>
        <div className={`text-xs tracking-widest uppercase mb-12 ${text3}`}>New York Cannabis House</div>
        <h1 className="text-2xl font-bold mb-3">Are you 21 or older?</h1>
        <p className="text-sm mb-10 max-w-xs opacity-60">You must be of legal age to purchase cannabis.</p>
        <div className="flex gap-4">
          <button onClick={() => setAgeVerified(true)} className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-10 py-4 rounded-full text-lg hover:bg-[#333] transition-all">Yes, I'm 21+</button>
          <button onClick={() => alert('You must be 21 or older to enter.')} className={`border font-bold px-10 py-4 rounded-full text-lg transition-all ${dark ? 'border-white/20 text-white/50' : 'border-[#1a1a1a]/30 text-[#666]'}`}>No</button>
        </div>
        <p className="text-xs mt-10 max-w-xs opacity-40">By entering you confirm you are of legal age to purchase cannabis in your state.</p>
      </main>
    )
  }

  // ── ORDER PLACED ──────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <main className={`min-h-screen flex flex-col items-center justify-center px-6 text-center transition-colors ${dark ? 'bg-[#0f0f0f] text-[#f5f0e8]' : 'bg-[#f5f0e8] text-[#1a1a1a]'}`}>
        <div className="text-6xl mb-6">🌿</div>
        <h1 className="text-3xl font-bold mb-3">Order Received!</h1>
        <p className="text-lg mb-2 opacity-70">Thanks, {name}!</p>
        <p className="text-sm mb-8 max-w-sm opacity-50">We are confirming your Cash App payment now. You will get a call or text at {phone} once your order is on the way.</p>
        <div className={`border rounded-2xl p-6 mb-8 max-w-sm w-full ${dark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-[#e0d9cc]'}`}>
          <p className="text-sm mb-1 opacity-50">Delivering to</p>
          <p className="font-bold">{address || 'Pickup'}</p>
          <div className={`border-t mt-4 pt-4 ${dark ? 'border-[#333]' : 'border-[#e0d9cc]'}`}>
            <p className="text-sm mb-1 opacity-50">Amount sent</p>
            <p className="text-[#c9a84c] text-2xl font-bold">${finalTotal.toFixed(2)}</p>
          </div>
        </div>
        {/* ── TRACK & BACK BUTTONS ── */}
        <a href="/track" className="bg-[#c9a84c] text-[#1a1a1a] font-bold px-8 py-3 rounded-full hover:bg-[#e8c97a] transition-all mb-3 block text-center">Track My Order →</a>
        <button onClick={() => { setOrderPlaced(false); setName(''); setPhone(''); setAddress(''); setNotes(''); setCheckoutReferral(''); setCheckoutReferralValid(false); setCheckoutReferralChecked(false); setCheckoutReferralChoice(null) }}
          className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-8 py-3 rounded-full hover:bg-[#333] transition-all">Back to Menu</button>
      </main>
    )
  }

  // ── MAIN STORE ────────────────────────────────────────────────
  return (
    <main className={`min-h-screen ${bg} ${text} transition-colors`}>

      {/* NAV */}
      <nav className={`flex items-center justify-between px-6 py-5 border-b ${border} sticky top-0 ${dark ? 'bg-[#0f0f0f]/95' : 'bg-[#f5f0e8]/95'} backdrop-blur z-40`}>
        <div>
          <div
            onClick={() => {
              const now = Date.now()
              const w = window as any
              if (!w._tapTimes) w._tapTimes = []
              w._tapTimes = w._tapTimes.filter((t: number) => now - t < 3000)
              w._tapTimes.push(now)
              if (w._tapTimes.length >= 7) { w._tapTimes = []; window.location.href = '/secret' }
            }}
            style={{fontFamily: 'Georgia, serif'}}
            className="text-xl font-bold tracking-wider cursor-default select-none"
          >LUCKY DAYZE</div>
          <div className={`text-xs tracking-widest uppercase ${text3}`}>New York Cannabis House</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggle} className="text-lg" aria-label="Toggle dark mode">{dark ? '☀️' : '🌙'}</button>
          <a href="/track" className={`text-sm font-semibold transition-all tracking-wide ${text2}`}>Track</a>
          <a href="/rewards" className="text-sm font-semibold text-[#c9a84c] hover:text-[#a07830] transition-all tracking-wide">Rewards</a>
          <button onClick={() => setCartOpen(true)} className="bg-[#1a1a1a] text-[#f5f0e8] text-sm font-bold px-5 py-2 rounded-full relative hover:bg-[#333] transition-all">
            Cart
            {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-[#c9a84c] text-[#1a1a1a] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className={`px-6 py-16 max-w-2xl border-b ${border}`}>
        <p className="text-xs font-bold tracking-widest uppercase text-[#c9a84c] mb-4">Fast Delivery · NYC</p>
        <h1 style={{fontFamily: 'Georgia, serif'}} className="text-5xl font-bold leading-tight mb-4">
          Premium Cannabis<br /><span className="italic text-[#c9a84c]">Delivered Fast.</span>
        </h1>
        <p className={`text-lg mb-8 max-w-md ${text2}`}>Flower, pre-rolls and more — delivered to your door in under 45 minutes.</p>
        <div className="flex gap-4 flex-wrap">
          <button onClick={() => setCartOpen(true)} className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-8 py-3 rounded-full hover:bg-[#333] transition-all">View Cart</button>
          <a href="/rewards" className={`border font-bold px-8 py-3 rounded-full transition-all ${dark ? 'border-white/20 text-[#f5f0e8] hover:border-white/40' : 'border-[#1a1a1a]/30 text-[#1a1a1a] hover:border-[#1a1a1a]'}`}>Rewards</a>
        </div>
      </section>

      {/* ETA BANNER */}
      <div className="mx-6 mt-8 bg-[#1a1a1a] rounded-2xl px-6 py-4 flex items-center gap-4 max-w-2xl">
        <span className="text-2xl">🚗</span>
        <div>
          <p className="font-semibold text-[#f5f0e8]">Delivering to NYC</p>
          <p className="text-[#f5f0e8]/50 text-sm">Open until 11 PM</p>
        </div>
        <div className="ml-auto bg-[#c9a84c]/20 text-[#c9a84c] text-sm font-bold px-4 py-1 rounded-full">⚡ 30-45 min</div>
      </div>

      {/* PRODUCTS */}
      <section className="px-6 py-12 pb-16">
        <div className="flex items-baseline justify-between mb-8 max-w-2xl">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold">The Menu</h2>
          <span className={`text-xs tracking-widest uppercase ${text3}`}>{products.length} products</span>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          {products.map((product: any) => {
            const isFlower = product.category === 'Flower'
            const weightPrices = product.weight_prices || {}
            const selected = selectedWeights[product.id] || { weight: '3.5', qty: 1 }
            const selectedPrice = isFlower ? (weightPrices[selected.weight] || product.price) : product.price
            const isLowStock = isFlower && (product.stock_grams || 0) < 14
            const maxQty = isFlower ? Math.floor((product.stock_grams || 0) / parseFloat(selected.weight)) : 99

            return (
              <div key={product.id} className={`${bg2} border ${border} rounded-2xl overflow-hidden ${borderHover} transition-all group flex flex-col`}>
                <div className={`h-28 ${bg3} flex items-center justify-center text-4xl group-hover:opacity-90 transition-all`}>
                  {product.emoji}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p style={{fontFamily: 'Georgia, serif'}} className="font-bold text-sm leading-tight">{product.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                      product.strain_type === 'Sativa' ? 'bg-amber-100 text-amber-700' :
                      product.strain_type === 'Indica' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>{product.strain_type}</span>
                  </div>
                  <p className={`text-xs mb-1 ${text3}`}>{product.category} · {product.thc}</p>
                  {isLowStock && <p className="text-amber-500 text-xs font-bold mb-1">⚠ Low Stock</p>}
                  {product.category === 'Pre-Rolls' && product.price < 15 && <p className="text-green-500 text-xs font-bold mb-1">🎉 2 for $15</p>}
                  {product.category === 'Pre-Rolls' && product.price >= 15 && <p className="text-green-500 text-xs font-bold mb-1">🎉 2 for $25</p>}

                  {/* FLOWER WEIGHT SELECTOR */}
                  {isFlower && Object.keys(weightPrices).length > 0 && (
                    <div className="mb-2 mt-1">
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        {Object.keys(weightPrices).map(w => (
                          <button key={w}
                            onClick={() => setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: w, qty: 1 } }))}
                            className={`py-1 rounded-lg text-xs font-bold transition-all ${selected.weight === w
                              ? 'bg-[#1a1a1a] text-[#f5f0e8]'
                              : dark ? 'bg-[#333] border border-[#444] text-[#aaa]' : 'bg-[#f5f0e8] border border-[#e0d9cc] text-[#666]'
                            }`}>
                            {WEIGHT_LABELS[w] || w + 'g'}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: selected.weight, qty: Math.max(1, (prev[product.id]?.qty || 1) - 1) } }))}
                          className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center transition-all ${dark ? 'border-white/20 text-[#aaa] hover:border-white/40' : 'border-[#1a1a1a]/20 text-[#666] hover:border-[#1a1a1a]'}`}>−</button>
                        <span className="text-xs font-bold w-4 text-center">{selected.qty}</span>
                        <button onClick={() => {
                          if ((selectedWeights[product.id]?.qty || 1) >= maxQty) { alert(`Only ${maxQty} available`); return }
                          setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: selected.weight, qty: (prev[product.id]?.qty || 1) + 1 } }))
                        }} className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center transition-all ${dark ? 'border-white/20 text-[#aaa] hover:border-white/40' : 'border-[#1a1a1a]/20 text-[#666] hover:border-[#1a1a1a]'}`}>+</button>
                        <span className={`text-xs ${text3}`}>{parseFloat(selected.weight) * selected.qty}g</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="font-bold text-sm">${isFlower ? selectedPrice * selected.qty : product.price}</span>
                    <button
                      onClick={() => {
                        if (isFlower) {
                          if (selected.qty > maxQty) { alert(`Only ${maxQty} available`); return }
                          addToCart({ ...product, price: selectedPrice, name: `${product.name} (${WEIGHT_LABELS[selected.weight] || selected.weight + 'g'})`, grams: parseFloat(selected.weight), qty_override: selected.qty })
                          setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: selected.weight, qty: 1 } }))
                        } else {
                          addToCart(product)
                        }
                      }}
                      className="bg-[#1a1a1a] text-[#f5f0e8] text-xs font-bold px-3 py-1.5 rounded-full hover:bg-[#c9a84c] hover:text-[#1a1a1a] transition-all"
                    >+ Add</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CART DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className={`w-full max-w-sm ${bg} border-l ${border} flex flex-col h-full overflow-y-auto`}>
            <div className={`flex items-center justify-between px-6 py-5 border-b ${border}`}>
              <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold">Your Cart</h2>
              <button onClick={() => setCartOpen(false)} className={`text-2xl leading-none ${text3}`}>×</button>
            </div>
            {cart.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${text3}`}>
                <span className="text-5xl">🛒</span>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="flex-1 px-6 py-4 flex flex-col gap-4">
                  {cart.map((item: any) => (
                    <div key={item.id + item.name} className="flex gap-3 items-start">
                      <div className={`w-12 h-12 ${bg3} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>{item.emoji}</div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{item.name}</p>
                        {item.promo && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{item.promo} 🎉</span>}
                        <p className={`text-xs ${text3}`}>{item.category}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {!item.isReward ? (
                            <>
                              <button onClick={() => changeQty(item.id, -1, item.name)} className={`w-6 h-6 rounded-full border text-sm flex items-center justify-center transition-all ${dark ? 'border-white/20 text-[#aaa]' : 'border-[#1a1a1a]/20 text-[#666] hover:border-[#1a1a1a]'}`}>−</button>
                              <span className="text-sm font-bold">{item.qty}</span>
                              <button onClick={() => changeQty(item.id, 1, item.name)} className={`w-6 h-6 rounded-full border text-sm flex items-center justify-center transition-all ${dark ? 'border-white/20 text-[#aaa]' : 'border-[#1a1a1a]/20 text-[#666] hover:border-[#1a1a1a]'}`}>+</button>
                            </>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">🎁 Free Reward</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${Math.round(item.price * item.qty)}</p>
                        <button onClick={() => removeFromCart(item.id, item.name)} className="text-xs mt-1 text-red-400 hover:text-red-500">remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`px-6 py-5 border-t ${border}`}>
                  <div className="flex justify-between mb-4">
                    <span className={text2}>Total</span>
                    <span className="font-bold text-xl">${total.toFixed(2)}</span>
                  </div>
                  <button onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}
                    className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-4 rounded-2xl text-lg hover:bg-[#333] transition-all">
                    Checkout → ${total.toFixed(2)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CHECKOUT */}
      {checkoutOpen && (
        <div className={`fixed inset-0 z-50 ${bg} overflow-y-auto`}>
          <div className="max-w-md mx-auto px-6 py-8">
            <button onClick={() => { setCheckoutOpen(false); setCartOpen(true) }} className={`text-sm mb-6 flex items-center gap-2 ${text2}`}>← Back to cart</button>
            <h1 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold mb-2">Checkout</h1>
            <p className={`text-sm mb-6 ${text2}`}>Fill in your info and send payment</p>

            {/* DELIVERY METHOD */}
            <div className={`${bg2} border ${border} rounded-2xl p-5 mb-6`}>
              <h3 className="font-bold mb-4">How would you like to receive your order?</h3>
              <div className="flex flex-col gap-3">
                {['delivery', 'pickup'].map(method => (
                  <div key={method} onClick={() => setDeliveryMethod(method as any)}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === method ? 'border-[#c9a84c] bg-[#c9a84c]/5' : border}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${deliveryMethod === method ? 'border-[#c9a84c]' : 'border-[#888]'}`}>
                      {deliveryMethod === method && <div className="w-2.5 h-2.5 rounded-full bg-[#c9a84c]" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{method === 'delivery' ? '🚗 Delivery' : '📍 Pickup'}</div>
                      <div className={`text-xs ${text3}`}>{method === 'delivery' ? 'We come to you · $25 minimum order' : 'No minimum · We\'ll send you a location in one of the 5 boroughs'}</div>
                    </div>
                    {method === 'delivery' && total > 0 && total < 25 && deliveryMethod === 'delivery' && <div className="text-xs text-red-500 font-bold">Add ${(25 - total).toFixed(2)} more</div>}
                    {method === 'delivery' && total >= 25 && deliveryMethod === 'delivery' && <div className="text-xs text-green-500 font-bold">✓ Eligible</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ORDER SUMMARY */}
            <div className={`${bg2} border ${border} rounded-2xl p-5 mb-6`}>
              <h3 className="font-bold mb-4">Order Summary</h3>
              {cart.map((item: any) => (
                <div key={item.id + item.name} className="flex justify-between text-sm mb-2">
                  <span className={text2}>{item.name} × {item.qty} {item.promo ? '🎉' : ''}</span>
                  <span className="font-semibold">${Math.round(item.price * item.qty)}</span>
                </div>
              ))}
              <div className={`border-t ${border} mt-3 pt-3 flex justify-between font-bold`}>
                <span>Total</span>
                <span className="text-[#c9a84c] text-lg">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* DELIVERY INFO */}
            <div className={`${bg2} border ${border} rounded-2xl p-5 mb-6`}>
              <h3 className="font-bold mb-4">Your Info</h3>
              {/* ── PASTE AFTER: name input ── */}
              <input type="text" placeholder="Your full name *" value={name} onChange={e => setName(e.target.value)} className={`w-full border rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] ${input}`} />
              {/* ── PASTE AFTER: phone input ── */}
              <input type="tel" placeholder="Phone number *" value={phone} onChange={e => setPhone(e.target.value)} className={`w-full border rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] ${input}`} />
              {deliveryMethod === 'delivery' && (
                <input type="text" placeholder="Delivery address *" value={address} onChange={e => setAddress(e.target.value)} className={`w-full border rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] ${input}`} />
              )}
              {deliveryMethod === 'pickup' && (
                <div className={`border rounded-xl px-4 py-3 text-sm mb-3 ${text3} ${dark ? 'bg-[#222] border-[#444]' : 'bg-[#f5f0e8] border-[#e0d9cc]'}`}>📍 After your order is confirmed we will text you a pickup location in one of the 5 boroughs.</div>
              )}
              {/* ── PASTE AFTER: notes textarea ── */}
              <textarea placeholder="Order notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c] resize-none ${input}`} />

              {/* REFERRAL CODE */}
              {!checkoutReferralChecked && (
                <div className="mt-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Referral code (optional)"
                      value={checkoutReferral}
                      onChange={e => { setCheckoutReferral(e.target.value.toUpperCase()); setCheckoutReferralValid(false); setCheckoutReferralError('') }}
                      className={`flex-1 border rounded-xl px-4 py-3 text-sm outline-none font-mono tracking-widest ${input}`}
                    />
                    <button onClick={checkReferralCode} disabled={!checkoutReferral}
                      className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-4 py-3 rounded-xl text-sm hover:bg-[#333] transition-all disabled:opacity-50">
                      Apply
                    </button>
                  </div>
                  {checkoutReferralError && <p className="text-red-500 text-xs mt-1">{checkoutReferralError}</p>}
                </div>
              )}

              {checkoutReferralValid && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-green-700 text-xs font-bold mb-2">✓ Code applied! +50 bonus points on signup. Choose your free mini pre-roll:</p>
                  <div className="flex gap-2">
                    {(['grabba', 'vegan', 'later'] as const).map(choice => (
                      <button key={choice} onClick={() => setCheckoutReferralChoice(choice)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${checkoutReferralChoice === choice ? 'bg-[#1a1a1a] text-[#f5f0e8] border-[#1a1a1a]' : 'border-[#e0d9cc] text-[#666]'}`}>
                        {choice === 'grabba' ? '😮‍💨 Grabba' : choice === 'vegan' ? '🥹 Vegan' : 'Claim Later'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PAYMENT */}
            <div className={`${bg2} border ${border} rounded-2xl p-5 mb-6`}>
              <h3 className="font-bold mb-2">Send Payment</h3>
              <p className={`text-sm mb-5 ${text2}`}>Send <span className="text-[#c9a84c] font-bold">${total.toFixed(2)}</span> to our Cash App then tap confirm.</p>
              <div className={`border rounded-xl p-6 text-center mb-4 ${dark ? 'bg-[#222] border-[#444]' : 'bg-[#f5f0e8] border-[#e0d9cc]'}`}>
                <div className="text-5xl mb-3">💚</div>
                <p style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg mb-1">Cash App</p>
                <p className={`text-sm mb-3 ${text3}`}>Tap to open Cash App and send payment:</p>
                <a href="https://cash.app/$Luckydayz3" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] text-3xl font-bold underline underline-offset-4 hover:text-[#a07830] transition-all">{'$Luckydayz3'}</a>
              </div>
              <p className={`text-xs text-center ${text3}`}>Screenshot your payment confirmation — you may be asked to verify</p>
            </div>

            <button onClick={placeOrder} disabled={loading}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-4 rounded-2xl text-lg hover:bg-[#333] transition-all disabled:opacity-50">
              {loading ? 'Placing Order...' : "I've Sent Payment ✓"}
            </button>
            <p className={`text-xs text-center mt-4 ${text3}`}>Your order will be confirmed once payment is verified. Average delivery 30–45 min.</p>
          </div>
        </div>
      )}

      {/* INSTALL PROMPT */}
      {showInstallPrompt && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 ${dark ? 'bg-[#1a1a1a] border-t border-[#333]' : 'bg-white border-t border-[#e0d9cc]'}`}>
          <div className="max-w-md mx-auto">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📲</span>
                <div>
                  <p className="font-bold text-sm">Add LuckyDayze to your Home Screen</p>
                  <p className={`text-xs ${text3}`}>Order faster — works like a real app!</p>
                </div>
              </div>
              <button onClick={() => { setShowInstallPrompt(false); localStorage.setItem('ld_install_prompt', 'seen') }} className={`text-xl leading-none ${text3}`}>×</button>
            </div>
            <div className={`rounded-xl p-3 text-xs ${dark ? 'bg-[#222]' : 'bg-[#f5f0e8]'} ${text2}`}>
              <p className="font-bold mb-1">iPhone / iPad:</p>
              <p>Tap the <span className="font-bold">Share</span> button (□↑) at the bottom of Safari → tap <span className="font-bold">Add to Home Screen</span></p>
              <p className="font-bold mt-2 mb-1">Android:</p>
              <p>Tap the <span className="font-bold">menu (⋮)</span> in Chrome → tap <span className="font-bold">Add to Home Screen</span></p>
            </div>
            <button onClick={() => { setShowInstallPrompt(false); localStorage.setItem('ld_install_prompt', 'seen') }}
              className="w-full mt-3 bg-[#1a1a1a] text-[#f5f0e8] font-bold py-2.5 rounded-xl text-sm hover:bg-[#333] transition-all">
              Got it!
            </button>
          </div>
        </div>
      )}

    </main>
  )
}