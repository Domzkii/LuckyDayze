'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Home() {
  const [ageVerified, setAgeVerified] = useState(false)
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

  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase.from('products').select('*')
      setProducts(data || [])
    }
    loadProducts()
  }, [])

  function addToCart(product: any) {
    setCart((prev: any[]) => {
      const existing = prev.find((i: any) => i.id === product.id)
      if (existing) {
        return prev.map((i: any) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { ...product, qty: 1 }]
    })
    setCartOpen(true)
  }

  function removeFromCart(id: any) {
    setCart((prev: any[]) => prev.filter((i: any) => i.id !== id))
  }

  function changeQty(id: any, delta: any) {
    setCart((prev: any[]) => prev.map((i: any) => {
      if (i.id !== id) return i
      const newQty = i.qty + delta
      if (newQty < 1) return null
      return { ...i, qty: newQty }
    }).filter(Boolean))
  }

  const total = cart.reduce((sum: number, i: any) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum: number, i: any) => sum + i.qty, 0)

  async function placeOrder() {
    if (!name || !phone || !address) {
      alert('Please fill in your name, phone number, and address.')
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
      customer_address: address,
      order_notes: notes,
      items: orderItems,
      total: total,
      status: 'pending_payment'
    })
    setLoading(false)
    if (error) {
      console.log(error)
      alert('Something went wrong: ' + error.message)
      return
    }
    await supabase.rpc('award_loyalty_points', {
  p_phone: phone,
  p_name: name,
  p_spent: total
})
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
    <main className="min-h-screen bg-[#0a0c0b] text-[#f0ede6] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">🌿</div>
      <div className="text-[#c9a84c] text-4xl font-bold mb-2">LuckyDayze</div>
      <div className="text-white/40 text-sm mb-12 tracking-widest uppercase">NYC Cannabis Delivery</div>
      <h1 className="text-2xl font-bold mb-3">Are you 21 or older?</h1>
      <p className="text-white/40 text-sm mb-10 max-w-xs">
        You must be of legal age to purchase cannabis. Please confirm your age to continue.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => setAgeVerified(true)}
          className="bg-[#c9a84c] text-black font-bold px-10 py-4 rounded-full text-lg hover:bg-[#e8c97a] transition-all"
        >
          Yes, I'm 21+
        </button>
        <button
          onClick={() => alert('You must be 21 or older to enter.')}
          className="border border-white/20 text-white/50 px-10 py-4 rounded-full text-lg hover:border-white/40 transition-all"
        >
          No
        </button>
      </div>
      <p className="text-white/20 text-xs mt-10 max-w-xs">
        By entering you confirm you are of legal age to purchase cannabis in your state.
      </p>
    </main>
  )
}
  if (orderPlaced) {
    return (
      <main className="min-h-screen bg-[#0a0c0b] text-[#f0ede6] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🌿</div>
        <h1 className="text-3xl font-bold mb-3">Order Received!</h1>
        <p className="text-white/50 text-lg mb-2">Thanks, {name}!</p>
        <p className="text-white/40 text-sm mb-8 max-w-sm">
          We are confirming your Cash App payment now. You will get a call or text at {phone} once your order is on the way.
        </p>
        <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-6 mb-8 max-w-sm w-full">
          <p className="text-white/50 text-sm mb-1">Delivering to</p>
          <p className="font-bold">{address}</p>
          <div className="border-t border-white/10 mt-4 pt-4">
            <p className="text-white/50 text-sm mb-1">Amount sent</p>
            <p className="text-[#c9a84c] text-2xl font-bold">${finalTotal.toFixed(2)}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setOrderPlaced(false)
            setName('')
            setPhone('')
            setAddress('')
            setNotes('')
          }}
          className="bg-[#c9a84c] text-black font-bold px-8 py-3 rounded-full"
        >
          Back to Menu
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0c0b] text-[#f0ede6]">

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0a0c0b]/90 backdrop-blur z-40">
        <div className="text-[#c9a84c] text-2xl font-bold tracking-tight">
          LuckyDayze
        </div>
        <a href="/rewards" className="text-sm font-bold text-[#c9a84c] hover:text-[#e8c97a] transition-all">
          Rewards
        </a>
        <button
          onClick={() => setCartOpen(true)}
          className="bg-[#c9a84c] text-black text-sm font-bold px-5 py-2 rounded-full relative"
        >
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-black text-[#c9a84c] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border border-[#c9a84c]">
              {cartCount}
            </span>
          )}
        </button>
      </nav>

      {/* HERO */}
      <section className="px-6 py-16 max-w-2xl">
        <p className="text-[#c9a84c] text-xs font-bold tracking-widest uppercase mb-3">
          🌿 Fast Delivery · NYC
        </p>
        <h1 className="text-5xl font-bold leading-tight mb-4">
          Premium Cannabis <br />
          <span className="text-[#c9a84c] italic">Delivered Fast</span>
        </h1>
        <p className="text-white/50 text-lg mb-8">
          Flower, edibles, vapes and more — delivered to your door in under 45 minutes.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-[#c9a84c] text-black font-bold px-8 py-3 rounded-full"
          >
            View Cart
          </button>
        </div>
      </section>

      {/* ETA BANNER */}
      <div className="mx-6 bg-[#1a3d2b] border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4 max-w-2xl">
        <span className="text-2xl">🚗</span>
        <div>
          <p className="font-semibold">Delivering to Lower East Side</p>
          <p className="text-white/50 text-sm">Open until 11 PM</p>
        </div>
        <div className="ml-auto bg-[#c9a84c]/20 text-[#c9a84c] text-sm font-bold px-4 py-1 rounded-full">
          ⚡ 32 min
        </div>
      </div>

      {/* CATEGORIES */}
      <section className="px-6 py-12">
        <h2 className="text-xl font-bold mb-6">Shop by Category</h2>
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          {[
            { icon: "🌿", name: "Flower" },
            { icon: "🚬", name: "Pre-Rolls" },
            { icon: "🍬", name: "Edibles" },
            { icon: "💨", name: "Vapes" },
            { icon: "🍯", name: "Concentrates" },
            { icon: "🛒", name: "Accessories" },
          ].map((cat) => (
            <div
              key={cat.name}
              className="bg-[#1c201e] border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-[#c9a84c]/50 transition-all"
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-semibold">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="px-6 pb-16">
        <h2 className="text-xl font-bold mb-6">Menu 🌿</h2>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          {products.map((product: any) => (
            <div
              key={product.id}
              className="bg-[#1c201e] border border-white/10 rounded-2xl overflow-hidden hover:border-[#c9a84c]/50 transition-all"
            >
              <div className="h-28 bg-[#1a3d2b] flex items-center justify-center text-5xl">
                {product.emoji}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-bold">{product.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    product.strain_type === 'Sativa' ? 'bg-yellow-500/20 text-yellow-400' :
                    product.strain_type === 'Indica' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {product.strain_type}
                  </span>
                </div>
                <p className="text-white/50 text-xs mb-1">{product.category} · {product.thc} THC</p>
                <p className="text-white/30 text-xs mb-3 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[#c9a84c] font-bold text-lg">${product.price}</span>
                  <button
                    onClick={() => addToCart(product)}
                    className="bg-[#c9a84c] text-black font-bold w-8 h-8 rounded-full text-lg hover:bg-[#e8c97a] transition-all"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CART DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="w-full max-w-sm bg-[#141816] border-l border-white/10 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-bold">Your Cart 🛒</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="text-white/50 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/30">
                <span className="text-5xl">🛒</span>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="flex-1 px-6 py-4 flex flex-col gap-4">
                  {cart.map((item: any) => (
                    <div key={item.id} className="flex gap-3 items-start">
                      <div className="w-12 h-12 bg-[#1a3d2b] rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {item.emoji}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{item.name}</p>
                        <p className="text-white/40 text-xs">{item.category}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => changeQty(item.id, -1)}
                            className="w-6 h-6 rounded-full border border-white/20 text-white/60 text-sm flex items-center justify-center hover:border-[#c9a84c] hover:text-[#c9a84c]"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold">{item.qty}</span>
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="w-6 h-6 rounded-full border border-white/20 text-white/60 text-sm flex items-center justify-center hover:border-[#c9a84c] hover:text-[#c9a84c]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[#c9a84c] font-bold">${(item.price * item.qty).toFixed(2)}</p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-white/20 text-xs mt-1 hover:text-red-400"
                        >
                          remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-6 py-5 border-t border-white/10">
                  <div className="flex justify-between mb-4">
                    <span className="text-white/50">Total</span>
                    <span className="text-[#c9a84c] font-bold text-xl">${total.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}
                    className="w-full bg-[#c9a84c] text-black font-bold py-4 rounded-2xl text-lg hover:bg-[#e8c97a] transition-all"
                  >
                    Checkout → ${total.toFixed(2)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CHECKOUT SCREEN */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0c0b] overflow-y-auto">
          <div className="max-w-md mx-auto px-6 py-8">
            <button
              onClick={() => { setCheckoutOpen(false); setCartOpen(true) }}
              className="text-white/50 text-sm mb-6 flex items-center gap-2 hover:text-white"
            >
              ← Back to cart
            </button>

            <h1 className="text-2xl font-bold mb-2">Checkout</h1>
            <p className="text-white/50 text-sm mb-8">Fill in your info and send payment</p>

            {/* ORDER SUMMARY */}
            <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-5 mb-6">
              <h3 className="font-bold mb-4">Order Summary</h3>
              {cart.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm mb-2">
                  <span className="text-white/70">{item.name} × {item.qty}</span>
                  <span className="font-semibold">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-white/10 mt-3 pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-[#c9a84c] text-lg">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* DELIVERY INFO */}
            <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-5 mb-6">
              <h3 className="font-bold mb-4">Delivery Info</h3>
              <input
                type="text"
                placeholder="Your full name *"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#242927] border border-white/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c]/50 placeholder-white/30"
              />
              <input
                type="tel"
                placeholder="Phone number *"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-[#242927] border border-white/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c]/50 placeholder-white/30"
              />
              <input
                type="text"
                placeholder="Delivery address *"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full bg-[#242927] border border-white/10 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c]/50 placeholder-white/30"
              />
              <textarea
                placeholder="Order notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-[#242927] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c]/50 placeholder-white/30 resize-none"
              />
            </div>

            {/* PAYMENT */}
            <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-5 mb-6">
              <h3 className="font-bold mb-2">Send Payment</h3>
              <p className="text-white/50 text-sm mb-5">
                Send <span className="text-[#c9a84c] font-bold">${total.toFixed(2)}</span> to our Cash App below then tap confirm.
              </p>
              <div className="bg-[#242927] border border-[#c9a84c]/20 rounded-xl p-6 text-center mb-4">
                <div className="text-5xl mb-3">💚</div>
                <p className="font-bold text-lg mb-1">Cash App</p>
                <p className="text-white/40 text-sm mb-3">Tap to open Cash App and send payment:</p>
                <a href="https://cash.app/$Luckydayz3" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] text-3xl font-bold underline underline-offset-4 hover:text-[#e8c97a] transition-all">{'$Luckydayz3'}</a>
              </div>
              <p className="text-white/30 text-xs text-center">
                Screenshot your payment confirmation — you may be asked to verify
              </p>
            </div>

            <button
              onClick={placeOrder}
              disabled={loading}
              className="w-full bg-[#c9a84c] text-black font-bold py-4 rounded-2xl text-lg hover:bg-[#e8c97a] transition-all disabled:opacity-50"
            >
              {loading ? 'Placing Order...' : "I've Sent Payment ✓"}
            </button>

            <p className="text-white/20 text-xs text-center mt-4">
              Your order will be confirmed once payment is verified. Average delivery 30–45 min.
            </p>
          </div>
        </div>
      )}

    </main>
  )
}