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

  useEffect(() => {
    if (authenticated) {
      loadOrders()
      Notification.requestPermission()
      const channel = supabase
        .channel('orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          loadOrders(true)
        })
        .subscribe()
      return () => {
        supabase.removeChannel(channel)
      }
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
          body: `${latest.customer_name} ordered $${latest.total} — ${latest.customer_address}`,
          icon: '/favicon.ico'
        })
      }
    }
    setOrders(newOrders)
    setLoading(false)
  }

  async function updateStatus(orderId: string, status: string) {
    if (status === 'delivered' && selectedOrder) {
      const input = window.prompt('Enter actual delivery cost for this order ($):', '10')
      if (input === null) return
      const actualDeliveryCost = parseFloat(input) || 10

      await supabase.from('orders').update({ status }).eq('id', orderId)

      const { data: activeWeek } = await supabase
        .from('weeks')
        .select('id')
        .eq('status', 'active')
        .single()

      const costPerGram = 400 / 112

      if (Array.isArray(selectedOrder.items)) {
        for (const item of selectedOrder.items) {
          const { data: product } = await supabase
            .from('products')
            .select('grams, stock_grams')
            .eq('name', item.name)
            .single()

          const isPreRoll = item.category === 'Pre-Rolls'
          const grams = isPreRoll ? 1 : (product?.grams || 3.5)
          const gramsSold = grams * item.qty
          const inventoryCost = costPerGram * gramsSold
          const revenue = item.price * item.qty
          const itemDeliveryCost = actualDeliveryCost / selectedOrder.items.length
          const netProfit = revenue - inventoryCost - itemDeliveryCost

          const roleSplits: Record<string, number> = {
            ceo: 35, cfo: 20, acquisitions: 25, delivery: 20
          }
          const roleDeliveryShares: Record<string, number> = {}
          Object.keys(roleSplits).forEach(role => {
            roleDeliveryShares[role] = parseFloat((itemDeliveryCost * (roleSplits[role] / 100)).toFixed(2))
          })

          await supabase.from('sales').insert({
            order_id: orderId,
            product_name: item.name,
            category: item.category,
            grams_sold: gramsSold,
            revenue: revenue,
            inventory_cost: inventoryCost,
            delivery_cost: itemDeliveryCost,
            net_profit: netProfit,
            delivery_shares: roleDeliveryShares,
            status: 'delivered',
            week_id: activeWeek?.id || null
          })

          if (isPreRoll) {
            const { data: flowerProducts } = await supabase
              .from('products')
              .select('id, stock_grams')
              .eq('category', 'Flower')
              .order('stock_grams', { ascending: false })
              .limit(1)
            if (flowerProducts && flowerProducts.length > 0) {
              const topFlower = flowerProducts[0]
              const newStock = Math.max(0, (topFlower.stock_grams || 0) - gramsSold)
              await supabase.from('products').update({ stock_grams: newStock }).eq('id', topFlower.id)
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
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    })
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const pending = orders.filter(o => o.status === 'pending_payment').length
  const active = orders.filter(o => ['confirmed', 'preparing', 'out_for_delivery'].includes(o.status)).length
  const delivered = orders.filter(o => o.status === 'delivered').length
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.total || 0), 0)

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
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (password === 'luckydayze2025') { setAuthenticated(true); setWrongPassword(false) }
                  else setWrongPassword(true)
                }
              }}
              className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]"
            />
            {wrongPassword && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <button
              onClick={() => {
                if (password === 'luckydayze2025') { setAuthenticated(true); setWrongPassword(false) }
                else setWrongPassword(true)
              }}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all"
            >
              Login
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a]">

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]/10 sticky top-0 bg-[#f5f0e8]/95 backdrop-blur z-40">
        <div>
          <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold tracking-wider">LUCKY DAYZE</div>
          <div className="text-xs tracking-widest uppercase text-[#999]">Admin Panel</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[#999] text-xs">Live</span>
          </div>
          <button onClick={() => loadOrders()} className="border border-[#1a1a1a]/20 text-[#666] text-sm font-bold px-4 py-2 rounded-full hover:border-[#1a1a1a] transition-all">
            Refresh
          </button>
          <a href="/finance" className="bg-[#1a1a1a] text-[#f5f0e8] text-sm font-bold px-5 py-2 rounded-full hover:bg-[#333] transition-all">
            Finance
          </a>
          <a href="/" className="border border-[#1a1a1a]/20 text-[#666] text-sm font-bold px-4 py-2 rounded-full hover:border-[#1a1a1a] transition-all">
            Store
          </a>
        </div>
      </nav>

      {/* STATS */}
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

      {/* FILTER TABS */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto max-w-2xl mx-auto">
        {['all', 'pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              filter === f
                ? 'bg-[#1a1a1a] text-[#f5f0e8]'
                : 'bg-white border border-[#e0d9cc] text-[#666]'
            }`}
          >
            {f === 'all' ? 'All Orders' : getStatusLabel(f)}
          </button>
        ))}
      </div>

      {/* ORDERS LIST */}
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
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="bg-white border border-[#e0d9cc] rounded-2xl p-4 cursor-pointer hover:border-[#c9a84c] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-base text-[#1a1a1a]">{order.customer_name}</div>
                    <div className="text-[#999] text-xs mt-0.5">{formatTime(order.created_at)}</div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusStyle(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                <div className="text-[#666] text-sm mb-3">{order.customer_address}</div>
                <div className="flex items-center justify-between">
                  <div className="text-[#999] text-xs">
                    {Array.isArray(order.items) ? order.items.map(i => `${i.emoji} ${i.name} x${i.qty}`).join(', ') : ''}
                  </div>
                  <div className="text-[#c9a84c] font-bold">${order.total}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full max-w-md bg-[#f5f0e8] border border-[#e0d9cc] rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e0d9cc]">
              <h2 style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg">Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-[#999] text-2xl leading-none hover:text-[#1a1a1a]">×</button>
            </div>

            <div className="p-6">
              {/* CUSTOMER INFO */}
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4 mb-4">
                <div className="text-[#999] text-xs font-bold uppercase tracking-wider mb-3">Customer</div>
                <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg mb-1 text-[#1a1a1a]">{selectedOrder.customer_name}</div>
                <a href={`tel:${selectedOrder.customer_phone}`} className="text-[#c9a84c] text-sm mb-1 block font-bold">
                  📞 {selectedOrder.customer_phone}
                </a>
                {selectedOrder.customer_address === 'PICKUP' ? (
                  <div className="text-[#666] text-sm">📍 Pickup order — send them location</div>
                ) : (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedOrder.customer_address)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm block">
                    📍 {selectedOrder.customer_address}
                  </a>
                )}
                {selectedOrder.order_notes && (
                  <div className="mt-3 bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl p-3 text-sm text-[#666]">
                    💬 {selectedOrder.order_notes}
                  </div>
                )}
              </div>

              {/* ITEMS */}
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

              {/* STATUS UPDATE */}
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-4 mb-4">
                <div className="text-[#999] text-xs font-bold uppercase tracking-wider mb-3">Update Status</div>
                <div className="flex flex-col gap-2">
                  {STATUSES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => updateStatus(selectedOrder.id, s.value)}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                        selectedOrder.status === s.value
                          ? 'bg-[#1a1a1a] text-[#f5f0e8]'
                          : 'bg-[#f5f0e8] border border-[#e0d9cc] text-[#666] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
                      }`}
                    >
                      {selectedOrder.status === s.value ? '✓ ' : ''}{s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[#999] text-xs text-center">
                Order placed {formatTime(selectedOrder.created_at)}
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}