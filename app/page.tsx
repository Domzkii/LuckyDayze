'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Home() {
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

  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase.from('products').select('*')
      setProducts(data || [])
    }
    loadProducts()

    // Check for claimed reward from rewards page
    const rewardRaw = localStorage.getItem('luckydayze_reward')
    if (rewardRaw) {
      try {
        const reward = JSON.parse(rewardRaw)
        const rewardItem = {
          id: 'reward_' + reward.key,
          name: reward.name,
          price: 0,
          qty: 1,
          emoji: '🎁',
          category: reward.key === 'free_eighth' ? 'Flower' : 'Pre-Rolls',
          isReward: true,
          rewardPhone: reward.phone
        }
        setCart([rewardItem])
        setCartOpen(true)
        localStorage.removeItem('luckydayze_reward')
      } catch (e) {}
    }
  }, [])

  function applyPreRollPricing(cart: any[]) {
    const regularPreRolls = cart.filter((i: any) => i.category === 'Pre-Rolls' && !i.isReward && (i.originalPrice || i.price) >= 15)
const miniPreRolls = cart.filter((i: any) => i.category === 'Pre-Rolls' && !i.isReward && (i.originalPrice || i.price) < 15)

    const totalRegular = regularPreRolls.reduce((sum: number, i: any) => sum + i.qty, 0)
    const totalMini = miniPreRolls.reduce((sum: number, i: any) => sum + i.qty, 0)

    // Regular pre-rolls: 1=$15, 2=$25
    const regularPairs = Math.floor(totalRegular / 2)
    const regularSingles = totalRegular % 2
    const totalRegularCost = (regularPairs * 25) + (regularSingles * 15)

    // Mini pre-rolls: 1=$10, 2=$15
    const miniPairs = Math.floor(totalMini / 2)
    const miniSingles = totalMini % 2
    const totalMiniCost = (miniPairs * 15) + (miniSingles * 10)

    return cart.map((i: any) => {
      if (i.category !== 'Pre-Rolls' || i.isReward) return i

      const isMini = i.name.toLowerCase().includes('mini')

      if (isMini) {
        const totalQty = miniPreRolls.reduce((sum: number, p: any) => sum + p.qty, 0)
        if (totalQty === 0) return i
        const isFirst = miniPreRolls[0]?.id === i.id
        if (isFirst) {
          const otherCost = miniPreRolls.filter((p: any) => p.id !== i.id).reduce((sum: number, p: any) => sum + Math.floor((p.qty / totalQty) * totalMiniCost), 0)
          const thisShare = totalMiniCost - otherCost
          return { ...i, price: thisShare / i.qty, promo: totalMini >= 2 ? '2 for $15' : null }
        } else {
          const share = Math.floor((i.qty / totalQty) * totalMiniCost)
          return { ...i, price: share / i.qty, promo: totalMini >= 2 ? '2 for $15' : null }
        }
      } else {
        const totalQty = regularPreRolls.reduce((sum: number, p: any) => sum + p.qty, 0)
        if (totalQty === 0) return i
        const isFirst = regularPreRolls[0]?.id === i.id
        if (isFirst) {
          const otherCost = regularPreRolls.filter((p: any) => p.id !== i.id).reduce((sum: number, p: any) => sum + Math.floor((p.qty / totalQty) * totalRegularCost), 0)
          const thisShare = totalRegularCost - otherCost
          return { ...i, price: thisShare / i.qty, promo: totalRegular >= 2 ? '2 for $25' : null }
        } else {
          const share = Math.floor((i.qty / totalQty) * totalRegularCost)
          return { ...i, price: share / i.qty, promo: totalRegular >= 2 ? '2 for $25' : null }
        }
      }
    })
  }

  function addToCart(product: any) {
    setCart((prev: any[]) => {
      let newCart
      const qty = product.qty_override || 1
      const existing = prev.find((i: any) => i.id === product.id && i.name === product.name)
      if (existing) {
        newCart = prev.map((i: any) => i.id === product.id && i.name === product.name ? { ...i, qty: i.qty + qty } : i)
      } else {
        newCart = [...prev, { ...product, qty, originalPrice: product.price }]
      }
      return applyPreRollPricing(newCart)
    })
  }

  function removeFromCart(id: any) {
    setCart((prev: any[]) => {
      const newCart = prev.filter((i: any) => i.id !== id)
      return applyPreRollPricing(newCart)
    })
  }

  function changeQty(id: any, delta: any) {
    setCart((prev: any[]) => {
      const newCart = prev.map((i: any) => {
        if (i.id !== id) return i
        const newQty = i.qty + delta
        if (newQty < 1) return null
        return { ...i, qty: newQty }
      }).filter(Boolean)
      return applyPreRollPricing(newCart)
    })
  }

  const total = cart.reduce((sum: number, i: any) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum: number, i: any) => sum + i.qty, 0)

  async function placeOrder() {
    if (!name || !phone) {
      alert('Please fill in your name and phone number.')
      return
    }
    if (deliveryMethod === 'delivery' && !address) {
      alert('Please fill in your delivery address.')
      return
    }
    if (deliveryMethod === 'delivery' && total < 25) {
      alert('Minimum order for delivery is $25. Add more items or select pickup!')
      return
    }
    setLoading(true)
    const orderItems = cart.map((i: any) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      emoji: i.emoji,
      category: i.category
    }))
    const { error } = await supabase.from('orders').insert({
      customer_name: name,
      customer_phone: phone,
      customer_address: deliveryMethod === 'delivery' ? address : 'PICKUP',
      order_notes: notes,
      items: orderItems,
      total: total,
      status: 'pending_payment'
    })
    setLoading(false)
    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }
    setFinalTotal(total)
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: name,
        customerPhone: phone,
        customerAddress: address,
        total: total,
        items: orderItems
      })
    })
    setCart([])
    setCheckoutOpen(false)
    setOrderPlaced(true)
  }

  if (!ageVerified) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🌿</div>
        <div style={{fontFamily: 'Georgia, serif'}} className="text-4xl font-bold text-[#1a1a1a] mb-1">LUCKY DAYZE</div>
        <div className="text-xs tracking-widest uppercase text-[#666] mb-12">New York Cannabis House</div>
        <h1 className="text-2xl font-bold mb-3">Are you 21 or older?</h1>
        <p className="text-[#666] text-sm mb-10 max-w-xs">You must be of legal age to purchase cannabis. Please confirm your age to continue.</p>
        <div className="flex gap-4">
          <button onClick={() => setAgeVerified(true)} className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-10 py-4 rounded-full text-lg hover:bg-[#333] transition-all">
            Yes, I'm 21+
          </button>
          <button onClick={() => alert('You must be 21 or older to enter.')} className="border border-[#1a1a1a]/30 text-[#666] px-10 py-4 rounded-full text-lg hover:border-[#1a1a1a] transition-all">
            No
          </button>
        </div>
        <p className="text-[#999] text-xs mt-10 max-w-xs">By entering you confirm you are of legal age to purchase cannabis in your state.</p>
      </main>
    )
  }

  if (orderPlaced) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🌿</div>
        <h1 className="text-3xl font-bold mb-3">Order Received!</h1>
        <p className="text-[#666] text-lg mb-2">Thanks, {name}!</p>
        <p className="text-[#888] text-sm mb-8 max-w-sm">We are confirming your Cash App payment now. You will get a call or text at {phone} once your order is on the way.</p>
        <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-8 max-w-sm w-full">
          <p className="text-[#888] text-sm mb-1">Delivering to</p>
          <p className="font-bold text-[#1a1a1a]">{address}</p>
          <div className="border-t border-[#e0d9cc] mt-4 pt-4">
            <p className="text-[#888] text-sm mb-1">Amount sent</p>
            <p className="text-[#c9a84c] text-2xl font-bold">${finalTotal.toFixed(2)}</p>
          </div>
        </div>
        <button
          onClick={() => { setOrderPlaced(false); setName(''); setPhone(''); setAddress(''); setNotes('') }}
          className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-8 py-3 rounded-full hover:bg-[#333] transition-all"
        >
          Back to Menu
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a]">

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]/10 sticky top-0 bg-[#f5f0e8]/95 backdrop-blur z-40">
        <div>
          <div
            onClick={() => {
              const now = Date.now()
              const w = window as any
              if (!w._tapTimes) w._tapTimes = []
              w._tapTimes = w._tapTimes.filter((t: number) => now - t < 3000)
              w._tapTimes.push(now)
              if (w._tapTimes.length >= 7) {
                w._tapTimes = []
                window.location.href = '/secret'
              }
            }}
            style={{fontFamily: 'Georgia, serif'}}
            className="text-xl font-bold tracking-wider text-[#1a1a1a] cursor-default select-none"
          >
            LUCKY DAYZE
          </div>
          <div className="text-xs tracking-widest uppercase text-[#999]">New York Cannabis House</div>
        </div>
        <a href="/rewards" className="text-sm font-semibold text-[#c9a84c] hover:text-[#a07830] transition-all hidden sm:block tracking-wide">
          Rewards
        </a>
        <button
          onClick={() => setCartOpen(true)}
          className="bg-[#1a1a1a] text-[#f5f0e8] text-sm font-bold px-5 py-2 rounded-full relative hover:bg-[#333] transition-all"
        >
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-[#c9a84c] text-[#1a1a1a] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </nav>

      {/* HERO */}
      <section className="px-6 py-16 max-w-2xl border-b border-[#1a1a1a]/10">
        <p className="text-xs font-bold tracking-widest uppercase text-[#c9a84c] mb-4">
          Fast Delivery · NYC
        </p>
        <h1 style={{fontFamily: 'Georgia, serif'}} className="text-5xl font-bold leading-tight mb-4 text-[#1a1a1a]">
          Premium Cannabis<br />
          <span className="italic text-[#c9a84c]">Delivered Fast.</span>
        </h1>
        <p className="text-[#666] text-lg mb-8 max-w-md">
          Flower, edibles, vapes and more — delivered to your door in under 45 minutes.
        </p>
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-8 py-3 rounded-full hover:bg-[#333] transition-all"
          >
            View Cart
          </button>
          <a href="/rewards" className="border border-[#1a1a1a]/30 text-[#1a1a1a] font-bold px-8 py-3 rounded-full hover:border-[#1a1a1a] transition-all">
            Rewards
          </a>
        </div>
      </section>

      {/* ETA BANNER */}
      <div className="mx-6 mt-8 bg-[#1a1a1a] rounded-2xl px-6 py-4 flex items-center gap-4 max-w-2xl">
        <span className="text-2xl">🚗</span>
        <div>
          <p className="font-semibold text-[#f5f0e8]">Delivering to Lower East Side</p>
          <p className="text-[#f5f0e8]/50 text-sm">Open until 11 PM</p>
        </div>
        <div className="ml-auto bg-[#c9a84c]/20 text-[#c9a84c] text-sm font-bold px-4 py-1 rounded-full">
          ⚡ 32 min
        </div>
      </div>

      {/* PRODUCTS */}
      <section className="px-6 py-12 pb-16">
        <div className="flex items-baseline justify-between mb-8 max-w-2xl">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold">The Menu</h2>
          <span className="text-xs tracking-widest uppercase text-[#999]">{products.length} products</span>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          {products.map((product: any) => {
            const isFlower = product.category === 'Flower'
            const weightPrices = product.weight_prices || {}
            const selected = selectedWeights[product.id] || { weight: '3.5', qty: 1 }
            const selectedPrice = isFlower ? (weightPrices[selected.weight] || product.price) : product.price
            const weightLabels: Record<string, string> = {
              '3.5': '1/8', '7': '1/4', '14': '1/2', '28': '1oz'
            }
            const isLowStock = isFlower && (product.stock_grams || 0) < 14
            const maxQty = isFlower ? Math.floor((product.stock_grams || 0) / parseFloat(selected.weight)) : 99

            return (
              <div key={product.id} className="bg-white border border-[#e0d9cc] rounded-2xl overflow-hidden hover:border-[#c9a84c] transition-all group">
                <div className="h-32 bg-[#f0ebe0] flex items-center justify-center text-5xl group-hover:bg-[#e8e0d0] transition-all">
                  {product.emoji}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p style={{fontFamily: 'Georgia, serif'}} className="font-bold text-[#1a1a1a] leading-tight">{product.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                      product.strain_type === 'Sativa' ? 'bg-amber-100 text-amber-700' :
                      product.strain_type === 'Indica' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>{product.strain_type}</span>
                  </div>
                  <p className="text-[#999] text-xs mb-1">{product.category} · {product.thc} THC</p>

                  {isLowStock && (
                    <p className="text-amber-600 text-xs font-bold mb-1">⚠ Low Stock</p>
                  )}

                  {product.category === 'Pre-Rolls' && product.price < 15 && (
                    <p className="text-green-600 text-xs font-bold mb-1">🎉 2 for $15</p>
                  )}
                  {product.category === 'Pre-Rolls' && product.price >= 15 && (
                    <p className="text-green-600 text-xs font-bold mb-1">🎉 2 for $25</p>
                  )}

                  <p className="text-[#888] text-xs mb-3 line-clamp-2">{product.description}</p>

                  {/* FLOWER WEIGHT SELECTOR */}
                  {isFlower && (
                    <div className="mb-3">
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        {Object.keys(weightPrices).map(w => (
                          <button
                            key={w}
                            onClick={() => setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: w, qty: prev[product.id]?.qty || 1 } }))}
                            className={`py-1 rounded-lg text-xs font-bold transition-all ${selected.weight === w ? 'bg-[#1a1a1a] text-[#f5f0e8]' : 'bg-[#f5f0e8] border border-[#e0d9cc] text-[#666]'}`}
                          >
                            {weightLabels[w] || w + 'g'}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: selected.weight, qty: Math.max(1, (prev[product.id]?.qty || 1) - 1) } }))}
                          className="w-7 h-7 rounded-full border border-[#1a1a1a]/20 text-[#666] text-sm flex items-center justify-center hover:border-[#1a1a1a]"
                        >−</button>
                        <span className="text-sm font-bold">{selected.qty}</span>
                        <button
                          onClick={() => {
                            if (selected.qty >= maxQty) {
                              alert(`Only ${maxQty} available at this weight`)
                              return
                            }
                            setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: selected.weight, qty: (prev[product.id]?.qty || 1) + 1 } }))
                          }}
                          className="w-7 h-7 rounded-full border border-[#1a1a1a]/20 text-[#666] text-sm flex items-center justify-center hover:border-[#1a1a1a]"
                        >+</button>
                        <span className="text-xs text-[#999] ml-1">{parseFloat(selected.weight) * selected.qty}g total</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <span className="text-[#1a1a1a] font-bold text-base">
                        ${isFlower ? selectedPrice * selected.qty : product.price}
                      </span>
                      {isFlower && selected.qty > 1 && (
                        <span className="text-[#999] text-xs ml-1">(${selectedPrice}/ea)</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (isFlower) {
                          if (selected.qty > maxQty) {
                            alert(`Only ${maxQty} available at this weight`)
                            return
                          }
                          addToCart({
                            ...product,
                            price: selectedPrice,
                            name: `${product.name} (${weightLabels[selected.weight] || selected.weight + 'g'})`,
                            grams: parseFloat(selected.weight),
                            qty_override: selected.qty
                          })
                          setSelectedWeights(prev => ({ ...prev, [product.id]: { weight: selected.weight, qty: 1 } }))
                        } else {
                          addToCart(product)
                        }
                      }}
                      className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-3 py-1.5 rounded-full text-xs hover:bg-[#c9a84c] hover:text-[#1a1a1a] transition-all whitespace-nowrap"
                    >
                      + Add
                    </button>
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
          <div className="w-full max-w-sm bg-[#f5f0e8] border-l border-[#e0d9cc] flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e0d9cc]">
              <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold">Your Cart</h2>
              <button onClick={() => setCartOpen(false)} className="text-[#999] text-2xl leading-none hover:text-[#1a1a1a]">×</button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#999]">
                <span className="text-5xl">🛒</span>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="flex-1 px-6 py-4 flex flex-col gap-4">
                  {cart.map((item: any) => (
                    <div key={item.id + item.name} className="flex gap-3 items-start">
                      <div className="w-12 h-12 bg-[#e8e0d0] rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {item.emoji}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-[#1a1a1a]">{item.name}</p>
                        {item.promo && (
                          <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{item.promo} 🎉</span>
                        )}
                        <p className="text-[#999] text-xs">{item.category}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {!item.isReward && (
                            <>
                              <button onClick={() => changeQty(item.id, -1)} className="w-6 h-6 rounded-full border border-[#1a1a1a]/20 text-[#666] text-sm flex items-center justify-center hover:border-[#1a1a1a] hover:text-[#1a1a1a]">−</button>
                              <span className="text-sm font-bold">{item.qty}</span>
                              <button onClick={() => changeQty(item.id, 1)} className="w-6 h-6 rounded-full border border-[#1a1a1a]/20 text-[#666] text-sm flex items-center justify-center hover:border-[#1a1a1a] hover:text-[#1a1a1a]">+</button>
                            </>
                          )}
                          {item.isReward && (
                            <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">🎁 Free Reward</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[#1a1a1a] font-bold">${Math.round(item.price * item.qty)}</p>
                        <button onClick={() => removeFromCart(item.id)} className="text-[#bbb] text-xs mt-1 hover:text-red-500">remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-5 border-t border-[#e0d9cc]">
                  <div className="flex justify-between mb-4">
                    <span className="text-[#666]">Total</span>
                    <span className="text-[#1a1a1a] font-bold text-xl">${total.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}
                    className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-4 rounded-2xl text-lg hover:bg-[#333] transition-all"
                  >
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
        <div className="fixed inset-0 z-50 bg-[#f5f0e8] overflow-y-auto">
          <div className="max-w-md mx-auto px-6 py-8">
            <button onClick={() => { setCheckoutOpen(false); setCartOpen(true) }} className="text-[#999] text-sm mb-6 flex items-center gap-2 hover:text-[#1a1a1a]">
              ← Back to cart
            </button>

            <h1 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold mb-2 text-[#1a1a1a]">Checkout</h1>
            <p className="text-[#888] text-sm mb-6">Fill in your info and send payment</p>

            {/* DELIVERY METHOD */}
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-6">
              <h3 className="font-bold mb-4 text-[#1a1a1a]">How would you like to receive your order?</h3>
              <div className="flex flex-col gap-3">
                <div
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === 'delivery' ? 'border-[#c9a84c] bg-[#c9a84c]/5' : 'border-[#e0d9cc]'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${deliveryMethod === 'delivery' ? 'border-[#c9a84c]' : 'border-[#ccc]'}`}>
                    {deliveryMethod === 'delivery' && <div className="w-2.5 h-2.5 rounded-full bg-[#c9a84c]" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-[#1a1a1a]">🚗 Delivery</div>
                    <div className="text-xs text-[#999]">We come to you · $25 minimum order</div>
                  </div>
                  {total > 0 && total < 25 && deliveryMethod === 'delivery' && (
                    <div className="text-xs text-red-500 font-bold">Add ${(25 - total).toFixed(2)} more</div>
                  )}
                  {total >= 25 && deliveryMethod === 'delivery' && (
                    <div className="text-xs text-green-600 font-bold">✓ Eligible</div>
                  )}
                </div>
                <div
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === 'pickup' ? 'border-[#c9a84c] bg-[#c9a84c]/5' : 'border-[#e0d9cc]'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${deliveryMethod === 'pickup' ? 'border-[#c9a84c]' : 'border-[#ccc]'}`}>
                    {deliveryMethod === 'pickup' && <div className="w-2.5 h-2.5 rounded-full bg-[#c9a84c]" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-[#1a1a1a]">📍 Pickup</div>
                    <div className="text-xs text-[#999]">No minimum · We'll send you a location in one of the 5 boroughs</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-6">
              <h3 className="font-bold mb-4 text-[#1a1a1a]">Order Summary</h3>
              {cart.map((item: any) => (
                <div key={item.id + item.name} className="flex justify-between text-sm mb-2">
                  <span className="text-[#666]">{item.name} × {item.qty} {item.promo ? '🎉' : ''}</span>
                  <span className="font-semibold text-[#1a1a1a]">${Math.round(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="border-t border-[#e0d9cc] mt-3 pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-[#c9a84c] text-lg">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-6">
              <h3 className="font-bold mb-4 text-[#1a1a1a]">Delivery Info</h3>
              <input type="text" placeholder="Your full name *" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb] text-[#1a1a1a]" />
              <input type="tel" placeholder="Phone number *" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb] text-[#1a1a1a]" />
              {deliveryMethod === 'delivery' && (
                <input type="text" placeholder="Delivery address *" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb] text-[#1a1a1a]" />
              )}
              {deliveryMethod === 'pickup' && (
                <div className="bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 text-[#888]">
                  📍 After your order is confirmed we will text you a pickup location in one of the 5 boroughs.
                </div>
              )}
              <textarea placeholder="Order notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c] placeholder-[#bbb] text-[#1a1a1a] resize-none" />
            </div>

            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-5 mb-6">
              <h3 className="font-bold mb-2 text-[#1a1a1a]">Send Payment</h3>
              <p className="text-[#888] text-sm mb-5">
                Send <span className="text-[#c9a84c] font-bold">${total.toFixed(2)}</span> to our Cash App then tap confirm.
              </p>
              <div className="bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl p-6 text-center mb-4">
                <div className="text-5xl mb-3">💚</div>
                <p style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg mb-1 text-[#1a1a1a]">Cash App</p>
                <p className="text-[#999] text-sm mb-3">Tap to open Cash App and send payment:</p>
                <a href="https://cash.app/$Luckydayz3" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] text-3xl font-bold underline underline-offset-4 hover:text-[#a07830] transition-all">{'$Luckydayz3'}</a>
              </div>
              <p className="text-[#bbb] text-xs text-center">Screenshot your payment confirmation — you may be asked to verify</p>
            </div>

            <button
              onClick={placeOrder}
              disabled={loading}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-4 rounded-2xl text-lg hover:bg-[#333] transition-all disabled:opacity-50"
            >
              {loading ? 'Placing Order...' : "I've Sent Payment ✓"}
            </button>

            <p className="text-[#bbb] text-xs text-center mt-4">
              Your order will be confirmed once payment is verified. Average delivery 30–45 min.
            </p>
          </div>
        </div>
      )}

    </main>
  )
}