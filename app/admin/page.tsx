'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const STATUSES = [
  { value: 'pending_payment', label: 'Pending Payment', color: 'bg-amber-100 text-amber-700' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  { value: 'preparing', label: 'Preparing', color: 'bg-purple-100 text-purple-700' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-orange-100 text-orange-700' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
]

interface OrderItem {
  id: string
  name: string
  price: number
  qty: number
  emoji: string
  category: string
}

interface Order {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string
  customer_address: string
  order_notes: string
  items: OrderItem[]
  total: number
  status: string
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filter, setFilter] = useState('all')
  const [membershipRequests, setMembershipRequests] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'orders' | 'members'>('orders')

  useEffect(() => {
    if (authenticated) {
      loadOrders()
      loadRequests()
      Notification.requestPermission()
      const channel = supabase
        .channel('orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          loadOrders(true)
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [authenticated])

  async function loadOrders(notify = false) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    const newOrders = data || []
    if (notify && newOrders.length > orders.length) {
      const latest = newOrders[0]
      if (Notification.permission === 'granted') {
        new Notification('New LuckyDayze Order!', {
          body: `${latest.customer_name} ordered $${latest.total}`,
          icon: '/favicon.ico'
        })
      }
    }
    setOrders(newOrders)
    setLoading(false)
  }

  async function loadRequests() {
    const { data } = await supabase
      .from('membership_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setMembershipRequests(data || [])
  }

  async function handleMembership(requestId: string, customerPhone: string, tier: string, approve: boolean) {
    await supabase.from('membership_requests').update({
      status: approve ? 'approved' : 'declined'
    }).eq('id', requestId)
    if (approve) {
      const paidUntil = tier === 'house'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null
      await supabase.from('loyalty').update({
        membership_tier: tier,
        membership_approved: true,
        membership_requested: null,
        ...(paidUntil ? { house_paid_until: paidUntil } : {})
      }).eq('customer_phone', customerPhone)
    } else {
      await supabase.from('loyalty').update({ membership_requested: null }).eq('customer_phone', customerPhone)
    }
    loadRequests()
  }

  async function updateStatus(orderId: string, status: string) {
    if (status === 'delivered' && selectedOrder) {
      const input = window.prompt('Enter actual delivery cost for this order ($):', '10')
      if (input === null) return
      const actualDeliveryCost = parseFloat(input) || 10

      await supabase.from('orders').update({ status }).eq('id', orderId)

      const { data: activeWeek } = await supabase
        .from('weeks').select('id').eq('status', 'active').single()

      const costPerGram = 400 / 112

      // LOYALTY — once per order
      const { data: loyaltyRecord } = await supabase
        .from('loyalty').select('*').eq('customer_phone', selectedOrder.customer_phone).single()

      const orderTotal = selectedOrder.total
      const currentTier = loyaltyRecord?.membership_tier || 'guest'
      const isHighSpend = orderTotal >= 50
      const pointsToAdd = (currentTier === 'member' && isHighSpend) || currentTier === 'house'
        ? Math.floor(orderTotal) * 2
        : Math.floor(orderTotal)

      if (loyaltyRecord) {
        const isFirstPurchase = (loyaltyRecord.purchase_count || 0) === 0

        await supabase.from('loyalty').update({
          purchase_count: (loyaltyRecord.purchase_count || 0) + 1,
          total_spent: (loyaltyRecord.total_spent || 0) + orderTotal,
          points: (loyaltyRecord.points || 0) + pointsToAdd
        }).eq('customer_phone', selectedOrder.customer_phone)

        // Award referrer 50 points on first purchase
        if (isFirstPurchase && loyaltyRecord.referred_by) {
          const { data: referrer } = await supabase
            .from('loyalty').select('*').eq('referral_code', loyaltyRecord.referred_by).single()
          if (referrer) {
            await supabase.from('loyalty').update({
              points: (referrer.points || 0) + 50,
              referral_count: (referrer.referral_count || 0) + 1
            }).eq('referral_code', loyaltyRecord.referred_by)
          }
        }
      } else {
        await supabase.from('loyalty').insert({
          customer_phone: selectedOrder.customer_phone,
          customer_name: selectedOrder.customer_name,
          purchase_count: 1,
          total_spent: orderTotal,
          points: pointsToAdd,
          membership_tier: 'guest',
          membership_status: 'active',
          referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        })
      }

      // ITEM LOOP — sales + inventory
      if (Array.isArray(selectedOrder.items)) {
        for (const item of selectedOrder.items) {
          const { data: product } = await supabase
            .from('products').select('grams, stock_grams').eq('name', item.name).single()

          const isPreRoll = item.category === 'Pre-Rolls'
          const grams = isPreRoll ? 1 : (product?.grams || 3.5)
          const gramsSold = grams * item.qty
          const inventoryCost = costPerGram * gramsSold
          const revenue = item.price * item.qty
          const itemDeliveryCost = actualDeliveryCost / selectedOrder.items.length
          const netProfit = revenue - inventoryCost - itemDeliveryCost

          const roleSplits: Record<string, number> = { ceo: 35, cfo: 20, acquisitions: 25, delivery: 20 }
          const roleDeliveryShares: Record<string, number> = {}
          Object.keys(roleSplits).forEach(role => {
            roleDeliveryShares[role] = parseFloat((itemDeliveryCost * (roleSplits[role] / 100)).toFixed(2))
          })

          await supabase.from('sales').insert({
            order_id: orderId,
            product_name: item.name,
            category: item.category,
            grams_sold: gramsSold,
            revenue,
            inventory_cost: inventoryCost,
            delivery_cost: itemDeliveryCost,
            net_profit: netProfit,
            delivery_shares: roleDeliveryShares,
            status: 'delivered',
            week_id: activeWeek?.id || null
          })

          if (isPreRoll) {
            const { data: flowerProducts } = await supabase
              .from('products').select('id, stock_grams').eq('category', 'Flower')
              .order('stock_grams', { ascending: false }).limit(1)
            if (flowerProducts && flowerProducts.length > 0) {
              const newStock = Math.max(0, (flowerProducts[0].stock_grams || 0) - gramsSold)
              await supabase.from('products').update({ stock_grams: newStock }).eq('id', flowerProducts[0].id)
            }
          } else if (product) {
            const newStock = Math.max(0, (product.stock_grams || 0) - gramsSold)
            await supabase.from('products').update({ stock_grams: newStock }).eq('name', item.name)
          }
        }
      }
    } else {
      await supabase.from('orders').update({ status }).eq('id', orderId)
    }

    setSelectedOrder(prev => prev ? { ...prev, status } : null)
    loadOrders()
  }

  function getStatusStyle(status: string) {
    return STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-600'
  }

  function getStatusLabel(status: string) {
    return STATUSES.find(s => s.value === status)?.label || status
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    })
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const pending = orders.filter(o => o.status === 'pending_payment').length
  const active = orders.filter(o => ['confirmed', 'preparing', 'out_for_delivery'].includes(o.status)).length
  const delivered = orders.filter(o => o.status === 'delivered').length
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.total || 0), 0)
  const pendingRequests = membershipRequests.filter(r => r.status === 'pending').length

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-1">LUCKY DAYZE</div>
            <div className="text-xs tracking-widest uppercase text-[#999]">Admin Panel</div>
          </div>
          <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-6">Enter Password</h2>
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { if (password === 'luckydayze2025') { setAuthenticated(true); setWrongPassword(false) } else setWrongPassword(true) } }}
              className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]" />
            {wrongPassword && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <button onClick={() => { if (password === 'luckydayze2025') { setAuthenticated(true); setWrongPassword(false) } else setWrongPassword(true) }}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all">Login</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a]">
      <nav className="border-b border-[#1a1a1a]/10 sticky top-0 bg-[#f5f0e8]/95 backdrop-blur z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold tracking-wider">LUCKY DAYZE</div>
            <div className="text-xs tracking-widest uppercase text-[#999]">Admin Panel</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[#999] text-xs hidden sm:block">Live</span>
            </div>
            <button onClick={() => loadOrders()} className="border border-[#1a1a1a]/20 text-[#666] text-xs font-bold px-3 py-1.5 rounded-full hover:border-[#1a1a1a] transition-all">Refresh</button>
            <a href="/finance" className="bg-[#1a1a1a] text-[#f5f0e8] text-xs font-bold px-3 py-1.5 rounded-full hover:bg-[#333] transition-all">Finance</a>
            <a href="/" className="border border-[#1a1a1a]/20 text-[#666] text-xs font-bold px-3 py-1.5 rounded-full hover:border-[#1a1a1a] transition-all">Store</a>
          </div>
        </div>
      </nav>

      <div className="flex gap-2 px-4 py-4 border-b border-[#1a1a1a]/10 max-w-2xl mx-auto">
        <button onClick={() => setActiveTab('orders')}
          className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-[#1a1a1a] text-[#f5f0e8]' : 'border border-[#1a1a1a]/20 text-[#666]'}`}>
          Orders
        </button>
        <button onClick={() => { setActiveTab('members'); loadRequests() }}
          className={`px-5 py-2 rounded-full text-sm font-bold transition-all relative ${activeTab === 'members' ? 'bg-[#1a1a1a] text-[#f5f0e8]' : 'border border-[#1a1a1a]/20 text-[#666]'}`}>
          Membership
          {pendingRequests > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">{pendingRequests}</span>
          )}
        </button>
      </div>

      {activeTab === 'orders' && (
        <>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 max-w-2xl mx-auto">
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4">
              <div className="text-[#999] text-xs mb-1">Pending Payment</div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-amber-600">{pending}</div>
            </div>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4">
              <div className="text-[#999] text-xs mb-1">Active Orders</div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-blue-600">{active}</div>
            </div>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4">
              <div className="text-[#999] text-xs mb-1">Delivered</div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-green-600">{delivered}</div>
            </div>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4">
              <div className="text-[#999] text-xs mb-1">Total Revenue</div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold text-[#c9a84c]">${revenue.toFixed(0)}</div>
            </div>
          </div>

          <div className="flex gap-2 px-4 pb-4 overflow-x-auto max-w-2xl mx-auto">
            {['all', 'pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-[#1a1a1a] text-[#f5f0e8]' : 'bg-white border border-[#e0d9cc] text-[#666]'}`}>
                {f === 'all' ? 'All Orders' : getStatusLabel(f)}
              </button>
            ))}
          </div>

          <div className="px-4 pb-24 max-w-2xl mx-auto">
            {loading ? (
              <div className="text-center text-[#999] py-20">Loading orders...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-[#999] py-20">
                <div className="text-4xl mb-3">📭</div>
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(order => (
                  <div key={order.id} onClick={() => setSelectedOrder(order)}
                    className="bg-white border border-[#e0d9cc] rounded-2xl p-4 cursor-pointer hover:border-[#c9a84c] transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-base text-[#1a1a1a]">{order.customer_name}</div>
                        <div className="text-[#999] text-xs mt-0.5">{formatTime(order.created_at)}</div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusStyle(order.status)}`}>{getStatusLabel(order.status)}</span>
                    </div>
                    <div className="text-[#666] text-sm mb-3">{order.customer_address}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-[#999] text-xs">{Array.isArray(order.items) ? order.items.map(i => `${i.emoji} ${i.name} x${i.qty}`).join(', ') : ''}</div>
                      <div className="text-[#c9a84c] font-bold">${order.total}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'members' && (
        <div className="px-4 pb-24 max-w-2xl mx-auto pt-6">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-4">Membership Requests</h2>
          {membershipRequests.length === 0 ? (
            <div className="text-center text-[#999] py-20">
              <div className="text-4xl mb-3">👥</div>
              <p>No membership requests yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {membershipRequests.map(req => (
                <div key={req.id} className="bg-white border border-[#e0d9cc] rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-base">{req.customer_name}</div>
                      <div className="text-[#999] text-xs">{req.customer_phone}</div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {req.status === 'pending' ? 'Pending' : req.status === 'approved' ? 'Approved ✓' : 'Declined'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-[#666] mb-4">
                    <span>📧 {req.customer_email || '—'}</span>
                    <span>🎂 {req.customer_birthday || '—'}</span>
                    <span>🏷️ Requesting: <span className={`font-bold ${req.requested_tier === 'house' ? 'text-[#c9a84c]' : 'text-green-700'}`}>{req.requested_tier === 'house' ? 'The House' : 'Member'}</span></span>
                    <span className="text-xs text-[#999]">Submitted {new Date(req.created_at).toLocaleDateString()}</span>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleMembership(req.id, req.customer_phone, req.requested_tier, true)}
                        className="flex-1 bg-[#1a1a1a] text-[#f5f0e8] font-bold py-2 rounded-xl text-sm hover:bg-[#333] transition-all">✓ Approve</button>
                      <button onClick={() => handleMembership(req.id, req.customer_phone, req.requested_tier, false)}
                        className="flex-1 border border-red-200 text-red-500 font-bold py-2 rounded-xl text-sm hover:bg-red-50 transition-all">✗ Decline</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full max-w-md bg-[#f5f0e8] border border-[#e0d9cc] rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e0d9cc]">
              <h2 style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg">Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-[#999] text-2xl leading-none hover:text-[#1a1a1a]">×</button>
            </div>
            <div className="p-6">
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4 mb-4">
                <div className="text-[#999] text-xs font-bold uppercase tracking-wider mb-3">Customer</div>
                <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg mb-1 text-[#1a1a1a]">{selectedOrder.customer_name}</div>
                <a href={`tel:${selectedOrder.customer_phone}`} className="text-[#c9a84c] text-sm mb-1 block font-bold">📞 {selectedOrder.customer_phone}</a>
                {selectedOrder.customer_address === 'PICKUP' ? (
                  <div className="text-[#666] text-sm">📍 Pickup order — send them location</div>
                ) : (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedOrder.customer_address)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm block">📍 {selectedOrder.customer_address}</a>
                )}
                {(selectedOrder as any).referral_code && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                    🎁 Referral code used: <span className="font-bold font-mono">{(selectedOrder as any).referral_code}</span>
                  </div>
                )}
              </div>
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4 mb-4">
                <div className="text-[#999] text-xs font-bold uppercase tracking-wider mb-3">Items Ordered</div>
                {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center mb-2">
                    <span className="text-sm text-[#1a1a1a]">{item.emoji} {item.name} x {item.qty}</span>
                    <span className="text-[#c9a84c] font-bold text-sm">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-[#e0d9cc] mt-3 pt-3 flex justify-between font-bold">
                  <span className="text-[#1a1a1a]">Total</span>
                  <span className="text-[#c9a84c]">${selectedOrder.total}</span>
                </div>
              </div>
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4 mb-4">
                <div className="text-[#999] text-xs font-bold uppercase tracking-wider mb-3">Update Status</div>
                <div className="flex flex-col gap-2">
                  {STATUSES.map(s => (
                    <button key={s.value} onClick={() => updateStatus(selectedOrder.id, s.value)}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${selectedOrder.status === s.value ? 'bg-[#1a1a1a] text-[#f5f0e8]' : 'bg-[#f5f0e8] border border-[#e0d9cc] text-[#666] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'}`}>
                      {selectedOrder.status === s.value ? '✓ ' : ''}{s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[#999] text-xs text-center">Order placed {formatTime(selectedOrder.created_at)}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}