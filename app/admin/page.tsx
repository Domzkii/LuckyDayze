'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const STATUSES = [
  { value: 'pending_payment', label: 'Pending Payment', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'preparing', label: 'Preparing', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500/20 text-green-400' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
]

export default function AdminPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadOrders()
    const channel = supabase
      .channel('orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function updateStatus(orderId, status) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setSelectedOrder(prev => prev ? { ...prev, status } : null)
    loadOrders()
  }

  function getStatusStyle(status) {
    return STATUSES.find(s => s.value === status)?.color || 'bg-gray-500/20 text-gray-400'
  }

  function getStatusLabel(status) {
    return STATUSES.find(s => s.value === status)?.label || status
  }

  function formatTime(ts) {
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

  return (
    <main className="min-h-screen bg-[#0a0c0b] text-[#f0ede6]">

      {/* TOP BAR */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0a0c0b]/90 backdrop-blur z-40">
        <div>
          <div className="text-[#c9a84c] text-xl font-bold">LuckyDayze Admin</div>
          <div className="text-white/40 text-xs">Order Management</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-white/40 text-xs">Live</span>
        </div>
      </nav>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-4">
          <div className="text-white/40 text-xs mb-1">Pending Payment</div>
          <div className="text-2xl font-bold text-yellow-400">{pending}</div>
        </div>
        <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-4">
          <div className="text-white/40 text-xs mb-1">Active Orders</div>
          <div className="text-2xl font-bold text-blue-400">{active}</div>
        </div>
        <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-4">
          <div className="text-white/40 text-xs mb-1">Delivered Today</div>
          <div className="text-2xl font-bold text-green-400">{delivered}</div>
        </div>
        <div className="bg-[#1c201e] border border-white/10 rounded-2xl p-4">
          <div className="text-white/40 text-xs mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-[#c9a84c]">${revenue.toFixed(0)}</div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
        {['all', 'pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              filter === f
                ? 'bg-[#c9a84c] text-black'
                : 'bg-[#1c201e] text-white/50 border border-white/10'
            }`}
          >
            {f === 'all' ? 'All Orders' : getStatusLabel(f)}
          </button>
        ))}
      </div>

      {/* ORDERS LIST */}
      <div className="px-4 pb-24">
        {loading ? (
          <div className="text-center text-white/30 py-20">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/30 py-20">
            <div className="text-4xl mb-3">📭</div>
            <p>No orders yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(order => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="bg-[#1c201e] border border-white/10 rounded-2xl p-4 cursor-pointer hover:border-[#c9a84c]/40 transition-all active:scale-99"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-base">{order.customer_name}</div>
                    <div className="text-white/40 text-xs mt-0.5">{formatTime(order.created_at)}</div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusStyle(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                <div className="text-white/50 text-sm mb-3">{order.customer_address}</div>
                <div className="flex items-center justify-between">
                  <div className="text-white/40 text-xs">
                    {Array.isArray(order.items) ? order.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(', ') : ''}
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full max-w-md bg-[#141816] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="font-bold text-lg">Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-white/40 text-2xl leading-none">×</button>
            </div>

            <div className="p-6">
              {/* CUSTOMER INFO */}
              <div className="bg-[#1c201e] rounded-2xl p-4 mb-4">
                <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Customer</div>
                <div className="font-bold text-lg mb-1">{selectedOrder.customer_name}</div>
                <a href={`tel:${selectedOrder.customer_phone}`} className="text-[#c9a84c] text-sm mb-1 block">
                  📞 {selectedOrder.customer_phone}
                </a>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedOrder.customer_address)}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm block">
                  📍 {selectedOrder.customer_address}
                </a>
                {selectedOrder.order_notes && (
                  <div className="mt-3 bg-[#242927] rounded-xl p-3 text-sm text-white/60">
                    💬 {selectedOrder.order_notes}
                  </div>
                )}
              </div>

              {/* ITEMS */}
              <div className="bg-[#1c201e] rounded-2xl p-4 mb-4">
                <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Items Ordered</div>
                {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center mb-2">
                    <span className="text-sm">{item.emoji} {item.name} × {item.qty}</span>
                    <span className="text-[#c9a84c] font-bold text-sm">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 mt-3 pt-3 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-[#c9a84c]">${selectedOrder.total}</span>
                </div>
              </div>

              {/* STATUS UPDATE */}
              <div className="bg-[#1c201e] rounded-2xl p-4 mb-4">
                <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Update Status</div>
                <div className="flex flex-col gap-2">
                  {STATUSES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => updateStatus(selectedOrder.id, s.value)}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                        selectedOrder.status === s.value
                          ? 'bg-[#c9a84c] text-black'
                          : 'bg-[#242927] text-white/60 hover:bg-[#2e3430]'
                      }`}
                    >
                      {selectedOrder.status === s.value ? '✓ ' : ''}{s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-white/20 text-xs text-center">
                Order placed {formatTime(selectedOrder.created_at)}
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}