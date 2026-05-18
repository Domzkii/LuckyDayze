'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useTheme } from '../theme'

const STATUSES = [
  { value: 'pending_payment', label: 'Pending Payment', icon: '💳', desc: 'Waiting to verify your Cash App payment' },
  { value: 'confirmed', label: 'Confirmed', icon: '✅', desc: 'Payment verified — your order is confirmed!' },
  { value: 'preparing', label: 'Preparing', icon: '📦', desc: 'We are packing your order right now' },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: '🚗', desc: 'Your order is on the way!' },
  { value: 'delivered', label: 'Delivered', icon: '🌿', desc: 'Enjoy! Come back soon.' },
  { value: 'cancelled', label: 'Cancelled', icon: '❌', desc: 'This order was cancelled' },
]

const STATUS_ORDER = ['pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']

export default function TrackPage() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const bg = dark ? 'bg-[#0f0f0f]' : 'bg-[#f5f0e8]'
  const bg2 = dark ? 'bg-[#1a1a1a]' : 'bg-white'
  const text = dark ? 'text-[#f5f0e8]' : 'text-[#1a1a1a]'
  const text2 = dark ? 'text-[#aaa]' : 'text-[#666]'
  const text3 = dark ? 'text-[#777]' : 'text-[#999]'
  const border = dark ? 'border-[#333]' : 'border-[#e0d9cc]'
  const input = dark ? 'bg-[#222] border-[#444] text-[#f5f0e8] placeholder-[#555]' : 'bg-[#f5f0e8] border-[#e0d9cc] text-[#1a1a1a] placeholder-[#bbb]'

  const [order, setOrder] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)

  async function lookupByPhone() {
    if (!phone) return
    setSearching(true)
    setNotFound(false)
    const cleanPhone = phone.replace(/\D/g, '')
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_phone', cleanPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSearching(false)
    if (data) setOrder(data)
    else setNotFound(true)
  }

  useEffect(() => {
    const channel = supabase
      .channel('order_tracking')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        if (order && payload.new.id === order.id) setOrder(payload.new)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [order])

  const currentStatus = STATUSES.find(s => s.value === order?.status)
  const currentIndex = STATUS_ORDER.indexOf(order?.status)

  return (
    <main className={`min-h-screen ${bg} ${text} transition-colors`}>
      <nav className={`flex items-center justify-between px-6 py-5 border-b ${border} sticky top-0 ${dark ? 'bg-[#0f0f0f]/95' : 'bg-[#f5f0e8]/95'} backdrop-blur z-40`}>
        <div>
          <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold tracking-wider">LUCKY DAYZE</div>
          <div className={`text-xs tracking-widest uppercase ${text3}`}>Order Tracking</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggle} className="text-lg">{dark ? '☀️' : '🌙'}</button>
          <a href="/" className={`border ${border} ${text2} text-sm font-bold px-4 py-2 rounded-full hover:border-[#c9a84c] transition-all`}>Store</a>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-6 py-10">
        {!order ? (
          <>
            <h1 style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-2">Track Your Order</h1>
            <p className={`text-sm mb-8 ${text2}`}>Enter your phone number to find your most recent order.</p>
            <div className={`${bg2} border ${border} rounded-2xl p-6`}>
              <input type="tel" placeholder="Your phone number" value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') lookupByPhone() }}
                className={`w-full border rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] ${input}`} />
              {notFound && <p className="text-red-500 text-xs mb-3">No active orders found for that number.</p>}
              <button onClick={lookupByPhone} disabled={searching}
                className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all disabled:opacity-50">
                {searching ? 'Searching...' : 'Find My Order'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#1a1a1a] rounded-2xl p-6 mb-6 text-center">
              <div className={`text-5xl mb-3 ${order.status === 'out_for_delivery' ? 'animate-bounce' : order.status === 'delivered' ? 'animate-pulse' : ''}`}>
                {currentStatus?.icon}
              </div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-[#f5f0e8] mb-2">{currentStatus?.label}</div>
              <p className="text-[#999] text-sm">{currentStatus?.desc}</p>
              {order.status === 'out_for_delivery' && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-[#c9a84c] rounded-full animate-ping"></span>
                  <span className="text-[#c9a84c] text-xs font-bold">On the way to you!</span>
                  <span className="w-2 h-2 bg-[#c9a84c] rounded-full animate-ping"></span>
                </div>
              )}
              {order.status === 'delivered' && (
                <div className="mt-3 bg-green-900/20 border border-green-500/30 rounded-xl px-4 py-2">
                  <p className="text-green-400 text-xs font-bold">🎉 Enjoy your order!</p>
                </div>
              )}
            </div>

            {order.status !== 'cancelled' && (
              <div className={`${bg2} border ${border} rounded-2xl p-5 mb-6`}>
                <div className={`text-xs uppercase tracking-wider ${text3} mb-4`}>Order Progress</div>
                <div className="flex items-center justify-between relative">
                  <div className={`absolute left-0 right-0 top-3 h-0.5 ${dark ? 'bg-white/10' : 'bg-[#e0d9cc]'} z-0`} />
                  <div className="absolute left-0 top-3 h-0.5 bg-[#c9a84c] z-0 transition-all duration-500"
                    style={{ width: currentIndex >= 0 ? `${(currentIndex / (STATUS_ORDER.length - 1)) * 100}%` : '0%' }} />
                  {STATUS_ORDER.map((status, idx) => {
                    const s = STATUSES.find(st => st.value === status)
                    const done = idx <= currentIndex
                    return (
                      <div key={status} className="flex flex-col items-center z-10">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? 'bg-[#c9a84c] text-[#1a1a1a]' : dark ? 'bg-[#333] text-[#666]' : 'bg-[#e0d9cc] text-[#999]'}`}>
                          {done ? '✓' : idx + 1}
                        </div>
                        <p className={`text-xs mt-1 text-center max-w-12 leading-tight ${done ? `font-bold ${text}` : text3}`}>
                          {s?.label.split(' ')[0]}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className={`${bg2} border ${border} rounded-2xl p-5 mb-6`}>
              <div className={`text-xs uppercase tracking-wider ${text3} mb-3`}>Order Details</div>
              <div className={`flex justify-between text-sm mb-2`}>
                <span className={text2}>Customer</span>
                <span className="font-bold">{order.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className={text2}>Delivering to</span>
                <span className="font-bold text-right max-w-[60%]">{order.customer_address === 'PICKUP' ? '📍 Pickup' : order.customer_address}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className={text2}>Order placed</span>
                <span className="font-bold">{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <div className={`border-t ${border} pt-4`}>
                {Array.isArray(order.items) && order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm mb-2">
                    <span className={text2}>{item.emoji} {item.name} × {item.qty}</span>
                    <span className="font-bold">${Math.round(item.price * item.qty)}</span>
                  </div>
                ))}
                <div className={`flex justify-between font-bold pt-2 border-t ${border} mt-2`}>
                  <span>Total</span>
                  <span className="text-[#c9a84c]">${order.total}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <a href="/" className={`flex-1 border ${border} ${text2} font-bold py-3 rounded-xl text-center text-sm hover:border-[#c9a84c] transition-all`}>Back to Store</a>
              <button onClick={() => { setOrder(null); setPhone(''); setNotFound(false) }}
                className="flex-1 bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl text-sm hover:bg-[#333] transition-all">
                Track Another
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}