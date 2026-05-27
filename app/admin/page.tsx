'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useTheme } from '../theme'

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
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const bg = dark ? 'bg-[#0f0f0f]' : 'bg-[#f5f0e8]'
  const bg2 = dark ? 'bg-[#1a1a1a]' : 'bg-white'
  const bg3 = dark ? 'bg-[#222]' : 'bg-[#f5f0e8]'
  const text = dark ? 'text-[#f5f0e8]' : 'text-[#1a1a1a]'
  const text2 = dark ? 'text-[#aaa]' : 'text-[#666]'
  const text3 = dark ? 'text-[#666]' : 'text-[#999]'
  const border = dark ? 'border-[#333]' : 'border-[#e0d9cc]'
  const input = dark ? 'bg-[#222] border-[#444] text-[#f5f0e8] placeholder-[#555]' : 'bg-white border-[#e0d9cc] text-[#1a1a1a] placeholder-[#bbb]'

  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filter, setFilter] = useState('all')
  const [membershipRequests, setMembershipRequests] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'orders' | 'scheduled' | 'sales' | 'members' | 'customers'>('orders')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [scheduledOrders, setScheduledOrders] = useState<any[]>([])
  const [loadingScheduled, setLoadingScheduled] = useState(false)
  const [salesEvents, setSalesEvents] = useState<any[]>([])
  const [showNewSale, setShowNewSale] = useState(false)
  const [saleTitle, setSaleTitle] = useState('')
  const [saleDiscountType, setSaleDiscountType] = useState<'percent' | 'dollar'>('percent')
  const [saleDiscountValue, setSaleDiscountValue] = useState('')
  const [saleAppliesTo, setSaleAppliesTo] = useState<'all' | 'flower' | 'prerolls'>('all')
  const [savingSale, setSavingSale] = useState(false)
  const [storeOpen, setStoreOpen] = useState(true)
  const [togglingStore, setTogglingStore] = useState(false)
  const [pickupLocations, setPickupLocations] = useState<any[]>([])
  const [showPickupManager, setShowPickupManager] = useState(false)
  const [newBorough, setNewBorough] = useState('Manhattan')
  const [newAddress, setNewAddress] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)
  const [arrivedOrders, setArrivedOrders] = useState<string[]>([])

  useEffect(() => {
    if (authenticated) {
      loadOrders()
      loadRequests()
      loadScheduledOrders()
      loadSalesEvents()
      loadStoreStatus()
      loadPickupLocations()

      const arrivedChannel = supabase.channel('arrived_orders')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
          if (payload.new.customer_arrived && !payload.old.customer_arrived) {
            if (Notification.permission === 'granted') {
              new Notification('🚨 Customer Arrived!', {
                body: `${payload.new.customer_name} has arrived at the pickup location!`,
                icon: '/favicon.ico'
              })
            }
            setArrivedOrders(prev => [...prev, payload.new.id])
            loadOrders()
          }
        })
        .subscribe()
      Notification.requestPermission()
      const channel = supabase.channel('orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders(true) })
        .subscribe()
      const scheduledChannel = supabase.channel('scheduled_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_orders' }, () => { loadScheduledOrders() })
        .subscribe()
      return () => { supabase.removeChannel(channel); supabase.removeChannel(scheduledChannel) }
    }
  }, [authenticated])

  async function loadOrders(notify = false) {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    const newOrders = data || []
    if (notify && newOrders.length > orders.length) {
      const latest = newOrders[0]
      if (Notification.permission === 'granted') {
        new Notification('New LuckyDayze Order!', { body: `${latest.customer_name} ordered $${latest.total}`, icon: '/favicon.ico' })
      }
    }
    setOrders(newOrders)
    setLoading(false)
  }

  async function loadRequests() {
    const { data } = await supabase.from('membership_requests').select('*').order('created_at', { ascending: false })
    setMembershipRequests(data || [])
  }

  async function loadScheduledOrders() {
    setLoadingScheduled(true)
    const { data } = await supabase.from('scheduled_orders').select('*').order('delivery_date', { ascending: true })
    setScheduledOrders(data || [])
    setLoadingScheduled(false)
  }
  async function loadSalesEvents() {
    const { data } = await supabase.from('sales_events').select('*').order('created_at', { ascending: false })
    setSalesEvents(data || [])
  }
  async function loadStoreStatus() {
    const { data } = await supabase.from('store_settings').select('is_open').eq('id', 1).single()
    if (data) setStoreOpen(data.is_open)
  }
async function loadPickupLocations() {
    const { data } = await supabase.from('pickup_locations').select('*').order('borough').order('created_at')
    setPickupLocations(data || [])
  }

  async function toggleStore() {
    setTogglingStore(true)
    const newStatus = !storeOpen
    await supabase.from('store_settings').update({ is_open: newStatus, updated_at: new Date().toISOString() }).eq('id', 1)
    setStoreOpen(newStatus)
    setTogglingStore(false)
  }

  async function searchCustomers() {
    if (!customerSearch) return
    setLoadingCustomers(true)
    setSelectedCustomer(null)
    setCustomerOrders([])
    const { data } = await supabase.from('loyalty').select('*')
      .or(`customer_phone.ilike.%${customerSearch}%,customer_name.ilike.%${customerSearch}%`)
      .order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoadingCustomers(false)
  }

  async function loadCustomerOrders(phone: string) {
    const { data } = await supabase.from('orders').select('*').eq('customer_phone', phone).order('created_at', { ascending: false })
    setCustomerOrders(data || [])
  }

  async function handleMembership(requestId: string, customerPhone: string, tier: string, approve: boolean) {
    await supabase.from('membership_requests').update({ status: approve ? 'approved' : 'declined' }).eq('id', requestId)
    if (approve) {
      const paidUntil = tier === 'house'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null
      await supabase.from('loyalty').update({
        membership_tier: tier, membership_approved: true, membership_requested: null,
        ...(paidUntil ? { house_paid_until: paidUntil } : {})
      }).eq('customer_phone', customerPhone)
    } else {
      await supabase.from('loyalty').update({ membership_requested: null }).eq('customer_phone', customerPhone)
    }
    loadRequests()
  }

  async function updateStatus(orderId: string, status: string) {
    if (status === 'delivered' && selectedOrder) {
      const inp = window.prompt('Enter actual delivery cost for this order ($):', '10')
      if (inp === null) return
      const actualDeliveryCost = parseFloat(inp) || 10
      await supabase.from('orders').update({ status }).eq('id', orderId)
      const { data: activeWeek } = await supabase.from('weeks').select('id').eq('status', 'active').single()
      const costPerGram = 400 / 112
      const { data: loyaltyRecord } = await supabase.from('loyalty').select('*').eq('customer_phone', selectedOrder.customer_phone).single()
      const orderTotal = selectedOrder.total
      const currentTier = loyaltyRecord?.membership_tier || 'guest'
      const isHighSpend = orderTotal >= 50
      const pointsToAdd = (currentTier === 'member' && isHighSpend) || currentTier === 'house' ? Math.floor(orderTotal) * 2 : Math.floor(orderTotal)

      if (loyaltyRecord) {
        const isFirstPurchase = (loyaltyRecord.purchase_count || 0) === 0
        await supabase.from('loyalty').update({
          purchase_count: (loyaltyRecord.purchase_count || 0) + 1,
          total_spent: (loyaltyRecord.total_spent || 0) + orderTotal,
          points: (loyaltyRecord.points || 0) + pointsToAdd
        }).eq('customer_phone', selectedOrder.customer_phone)
        if (isFirstPurchase && loyaltyRecord.referred_by) {
          const { data: referrer } = await supabase.from('loyalty').select('*').eq('referral_code', loyaltyRecord.referred_by).single()
          if (referrer) {
            await supabase.from('loyalty').update({
              points: (referrer.points || 0) + 50,
              referral_count: (referrer.referral_count || 0) + 1
            }).eq('referral_code', loyaltyRecord.referred_by)
          }
        }
      } else {
        await supabase.from('loyalty').insert({
          customer_phone: selectedOrder.customer_phone, customer_name: selectedOrder.customer_name,
          purchase_count: 1, total_spent: orderTotal, points: pointsToAdd,
          membership_tier: 'guest', membership_status: 'active',
          referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        })
      }

      if (Array.isArray(selectedOrder.items)) {
        for (const item of selectedOrder.items) {
          const { data: product } = await supabase.from('products').select('id, grams, stock_grams').eq('name', item.name).single()
          const isPreRoll = item.category === 'Pre-Rolls'
          const grams = isPreRoll ? 1 : (product?.grams || 3.5)
          const gramsSold = grams * item.qty
          const inventoryCost = costPerGram * gramsSold
          const revenue = item.price * item.qty
          const itemDeliveryCost = actualDeliveryCost / selectedOrder.items.length
          const netProfit = revenue - inventoryCost - itemDeliveryCost
          if (product?.id && !isPreRoll) {
            const newGrams = Math.max(0, (product.stock_grams || 0) - gramsSold)
            await supabase.from('products').update({ stock_grams: newGrams, in_stock: newGrams > 0 }).eq('id', product.id)
          }
          const roleSplits: Record<string, number> = { ceo: 35, cfo: 20, acquisitions: 25, delivery: 20 }
          const roleDeliveryShares: Record<string, number> = {}
          Object.keys(roleSplits).forEach(role => {
            roleDeliveryShares[role] = parseFloat((itemDeliveryCost * (roleSplits[role] / 100)).toFixed(2))
          })
          await supabase.from('sales').insert({
            order_id: orderId, product_name: item.name, category: item.category,
            grams_sold: gramsSold, revenue, inventory_cost: inventoryCost,
            delivery_cost: itemDeliveryCost, net_profit: netProfit,
            delivery_shares: roleDeliveryShares, status: 'delivered', week_id: activeWeek?.id || null
          })
          if (isPreRoll) {
            const { data: flowerProducts } = await supabase.from('products').select('id, stock_grams').eq('category', 'Flower').order('stock_grams', { ascending: false }).limit(1)
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
    const { data: topStrain } = await supabase.from('sales').select('product_name, grams_sold').eq('category', 'Flower')
      .then(async ({ data }) => {
        if (!data) return { data: null }
        const totals: Record<string, number> = {}
        data.forEach((s: any) => { totals[s.product_name] = (totals[s.product_name] || 0) + s.grams_sold })
        const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]
        return { data: top ? top[0] : null }
      })
    if (topStrain) {
      await supabase.from('products').update({ is_popular: false }).eq('category', 'Flower')
      await supabase.from('products').update({ is_popular: true }).eq('name', topStrain)
    }
    setSelectedOrder(prev => prev ? { ...prev, status } : null)
    loadOrders()
  }

  function getStatusStyle(status: string) { return STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-600' }
  function getStatusLabel(status: string) { return STATUSES.find(s => s.value === status)?.label || status }
  function formatTime(ts: string) {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const pending = orders.filter(o => o.status === 'pending_payment').length
  const active = orders.filter(o => ['confirmed', 'preparing', 'out_for_delivery'].includes(o.status)).length
  const delivered = orders.filter(o => o.status === 'delivered').length
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.total || 0), 0)
  const pendingRequests = membershipRequests.filter(r => r.status === 'pending').length
  const dueTodayCount = scheduledOrders.filter((o: any) => new Date(o.delivery_date) <= new Date() && o.status === 'pending').length

  if (!authenticated) {
    return (
      <main className={`min-h-screen ${bg} ${text} flex flex-col items-center justify-center px-6 transition-colors`}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-1">LUCKY DAYZE</div>
            <div className={`text-xs tracking-widest uppercase ${text3}`}>Admin Panel</div>
          </div>
          <div className={`${bg2} border ${border} rounded-2xl p-6`}>
            <h2 className="font-bold text-lg mb-6">Enter Password</h2>
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { if (password === 'luckydayze2025') { setAuthenticated(true); setWrongPassword(false) } else setWrongPassword(true) } }}
              className={`w-full border rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] ${input}`} />
            {wrongPassword && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <button onClick={() => { if (password === 'luckydayze2025') { setAuthenticated(true); setWrongPassword(false) } else setWrongPassword(true) }}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all">Login</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={`min-h-screen ${bg} ${text} transition-colors`}>
      <nav className={`border-b ${border} sticky top-0 ${dark ? 'bg-[#0f0f0f]/95' : 'bg-[#f5f0e8]/95'} backdrop-blur z-40`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold tracking-wider">LUCKY DAYZE</div>
            <div className={`text-xs tracking-widest uppercase ${text3}`}>Admin Panel</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className={`${text3} text-xs hidden sm:block`}>Live</span>
            </div>
            <button onClick={toggle} className="text-lg px-2" aria-label="Toggle dark mode">{dark ? '☀️' : '🌙'}</button>
            <button onClick={() => loadOrders()} className={`border ${border} ${text2} text-xs font-bold px-3 py-1.5 rounded-full hover:border-[#c9a84c] transition-all`}>Refresh</button>
            <button onClick={toggleStore} disabled={togglingStore}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${storeOpen ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
              {togglingStore ? '...' : storeOpen ? '🟢 Open' : '🔴 Closed'}
            </button>
            <button onClick={() => setShowPickupManager(true)}
              className={`border ${border} ${text2} text-xs font-bold px-3 py-1.5 rounded-full hover:border-[#c9a84c] transition-all`}>
              📍 Locations
            </button>
            <a href="/finance" className="bg-[#1a1a1a] text-[#f5f0e8] text-xs font-bold px-3 py-1.5 rounded-full hover:bg-[#333] transition-all">Finance</a>
            <a href="/" className={`border ${border} ${text2} text-xs font-bold px-3 py-1.5 rounded-full hover:border-[#c9a84c] transition-all`}>Store</a>
          </div>
        </div>
      </nav>

      <div className={`flex gap-2 px-4 py-4 border-b ${border} max-w-2xl mx-auto overflow-x-auto`}>
        {(['orders', 'scheduled', 'sales', 'members', 'customers'] as const).map(t => (
          <button key={t} onClick={() => {
            setActiveTab(t)
            if (t === 'members') loadRequests()
            if (t === 'scheduled') loadScheduledOrders()
            if (t === 'sales') loadSalesEvents()
            if (t === 'customers') { setCustomers([]); setSelectedCustomer(null) }
          }}
            className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all relative ${activeTab === t ? 'bg-[#1a1a1a] text-[#f5f0e8]' : `border ${border} ${text2}`}`}>
            {t === 'members' ? 'Membership' : t === 'scheduled' ? 'Scheduled' : t === 'sales' ? 'Sales' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'members' && pendingRequests > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">{pendingRequests}</span>
            )}
            {t === 'scheduled' && dueTodayCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">{dueTodayCount}</span>
            )}
            {t === 'sales' && salesEvents.some((s: any) => s.is_active) && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">🔥</span>
            )}
          </button>
        ))}
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 max-w-2xl mx-auto">
            {[
              { label: 'Pending Payment', value: pending, color: 'text-amber-500' },
              { label: 'Active Orders', value: active, color: 'text-blue-500' },
              { label: 'Delivered', value: delivered, color: 'text-green-500' },
              { label: 'Total Revenue', value: `$${revenue.toFixed(0)}`, color: 'text-[#c9a84c]' },
            ].map(stat => (
              <div key={stat.label} className={`${bg2} border ${border} rounded-2xl p-4`}>
                <div className={`${text3} text-xs mb-1`}>{stat.label}</div>
                <div style={{fontFamily: 'Georgia, serif'}} className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-4 pb-4 overflow-x-auto max-w-2xl mx-auto">
            {['all', 'pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-[#1a1a1a] text-[#f5f0e8]' : `${bg2} border ${border} ${text2}`}`}>
                {f === 'all' ? 'All Orders' : getStatusLabel(f)}
              </button>
            ))}
          </div>
          <div className="px-4 pb-24 max-w-2xl mx-auto">
            {loading ? (
              <div className={`text-center ${text3} py-20`}>Loading orders...</div>
            ) : filtered.length === 0 ? (
              <div className={`text-center ${text3} py-20`}>
                <div className="text-4xl mb-3">📭</div>
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(order => (
                  <div key={order.id} onClick={() => setSelectedOrder(order)}
                    className={`${bg2} border ${border} rounded-2xl p-4 cursor-pointer hover:border-[#c9a84c] transition-all`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-base">{order.customer_name}</div>
                        <div className={`${text3} text-xs mt-0.5`}>{formatTime(order.created_at)}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusStyle(order.status)}`}>{getStatusLabel(order.status)}</span>
                        {(arrivedOrders.includes(order.id) || (order as any).customer_arrived) && (
                          <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">🚨 Arrived!</span>
                        )}
                      </div>
                    </div>
                    <div className={`${text2} text-sm mb-3`}>{order.customer_address}</div>
                    {(order as any).cash_tag && (
                    <div className="text-green-500 text-xs font-bold mb-2">💚 ${(order as any).cash_tag}</div>
                  )}
                    <div className="flex items-center justify-between">
                      <div className={`${text3} text-xs`}>{Array.isArray(order.items) ? order.items.map(i => `${i.emoji} ${i.name} x${i.qty}`).join(', ') : ''}</div>
                      <div className="text-[#c9a84c] font-bold">${order.total}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* SCHEDULED TAB */}
      {activeTab === 'scheduled' && (
        <div className="px-4 pb-24 max-w-2xl mx-auto pt-6">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-4">Scheduled Orders</h2>
          {loadingScheduled ? (
            <div className={`text-center ${text3} py-20`}>Loading...</div>
          ) : scheduledOrders.length === 0 ? (
            <div className={`text-center ${text3} py-20`}>
              <div className="text-4xl mb-3">📅</div>
              <p>No scheduled orders yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {scheduledOrders.map((order: any) => {
                const isToday = new Date(order.delivery_date).toDateString() === new Date().toDateString()
                const isOverdue = new Date(order.delivery_date) < new Date() && order.status === 'pending'
                const isRecurring = order.frequency !== 'once'
                return (
                  <div key={order.id} className={`${bg2} border ${isOverdue ? 'border-red-500' : isToday ? 'border-[#c9a84c]' : border} rounded-2xl p-5`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-base">{order.customer_name}</div>
                        <div className={`${text3} text-xs`}>{order.customer_phone}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isOverdue && <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">⚠ Overdue</span>}
                        {isToday && !isOverdue && <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] font-bold px-2 py-0.5 rounded-full">📅 Today</span>}
                        {isRecurring && <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">🔄 {order.frequency}</span>}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.status === 'confirmed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                    <div className={`${text2} text-sm mb-2`}>📍 {order.customer_address}</div>
                    <div className={`${text3} text-xs mb-2`}>
                      🗓 {order.delivery_date}{order.delivery_time_window ? ` · ${order.delivery_time_window}` : ''}
                      {order.discount_pct > 0 && <span className="text-green-500 font-bold ml-2">({order.discount_pct}% off)</span>}
                    </div>
                    <div className={`${text3} text-xs mb-3`}>
                      {Array.isArray(order.items) ? order.items.map((i: any) => `${i.emoji} ${i.name} x${i.qty}`).join(', ') : ''}
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-[#c9a84c]">${order.total?.toFixed(2)}</span>
                      {isRecurring && order.next_due_date && <span className={`text-xs ${text3}`}>Next: {order.next_due_date}</span>}
                    </div>
                    {order.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          const { error } = await supabase.from('orders').insert({
                            customer_name: order.customer_name,
                            customer_phone: order.customer_phone,
                            customer_address: order.customer_address,
                            order_notes: order.order_notes,
                            items: order.items,
                            total: order.total,
                            status: 'confirmed',
                            referral_code: order.referral_code,
                            referral_reward: order.referral_reward
                          })
                          if (!error) {
                            const nextDue = order.frequency !== 'once' && order.next_due_date ? (() => {
                              const d = new Date(order.next_due_date)
                              if (order.frequency === 'weekly') d.setDate(d.getDate() + 7)
                              else if (order.frequency === 'biweekly') d.setDate(d.getDate() + 14)
                              else if (order.frequency === 'monthly') d.setMonth(d.getMonth() + 1)
                              return d.toISOString().split('T')[0]
                            })() : null
                            await supabase.from('scheduled_orders').update({
                              status: 'confirmed',
                              recurring_count: (order.recurring_count || 0) + 1,
                              next_due_date: nextDue,
                              delivery_date: order.next_due_date || order.delivery_date
                            }).eq('id', order.id)
                            if (order.frequency !== 'once' && (order.recurring_count || 0) + 1 >= 3) {
                              const { data: loyalty } = await supabase.from('loyalty').select('*').eq('customer_phone', order.customer_phone).maybeSingle()
                              if (loyalty && loyalty.membership_tier === 'guest') {
                                await supabase.from('loyalty').update({ membership_requested: 'member' }).eq('customer_phone', order.customer_phone)
                              }
                            }
                            loadScheduledOrders()
                          }
                        }} className="flex-1 bg-[#1a1a1a] text-[#f5f0e8] font-bold py-2 rounded-xl text-sm hover:bg-[#333] transition-all">
                          ✓ Confirm & Queue Order
                        </button>
                        <button onClick={async () => {
                          await supabase.from('scheduled_orders').update({ status: 'cancelled' }).eq('id', order.id)
                          loadScheduledOrders()
                        }} className="border border-red-400 text-red-400 font-bold py-2 px-4 rounded-xl text-sm hover:bg-red-500/10 transition-all">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SALES TAB */}
      {activeTab === 'sales' && (
        <div className="px-4 pb-24 max-w-2xl mx-auto pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold">Sale Events</h2>
            <button onClick={() => setShowNewSale(true)}
              className="bg-[#c9a84c] text-[#1a1a1a] font-bold px-4 py-2 rounded-full text-sm hover:bg-[#e8c97a] transition-all">
              + New Sale
            </button>
          </div>

          {salesEvents.length === 0 ? (
            <div className={`text-center ${text3} py-20`}>
              <div className="text-4xl mb-3">🏷️</div>
              <p>No sales created yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {salesEvents.map((sale: any) => (
                <div key={sale.id} className={`${bg2} border ${sale.is_active ? 'border-[#c9a84c]' : border} rounded-2xl p-5`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-base">{sale.title}</div>
                      <div className={`${text3} text-xs mt-1`}>
                        {sale.discount_type === 'percent' ? `${sale.discount_value}% off` : `$${sale.discount_value} off`} · {sale.applies_to === 'all' ? 'Entire order' : sale.applies_to === 'flower' ? 'Flower only' : 'Pre-Rolls only'}
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${sale.is_active ? 'bg-green-100 text-green-700' : `${dark ? 'bg-[#333] text-[#666]' : 'bg-gray-100 text-gray-500'}`}`}>
                      {sale.is_active ? '🔥 Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      await supabase.from('sales_events').update({ is_active: false }).neq('id', sale.id)
                      await supabase.from('sales_events').update({ is_active: !sale.is_active }).eq('id', sale.id)
                      loadSalesEvents()
                    }} className={`flex-1 font-bold py-2 rounded-xl text-sm transition-all ${sale.is_active ? `border ${border} ${text2} hover:border-red-400 hover:text-red-400` : 'bg-[#c9a84c] text-[#1a1a1a] hover:bg-[#e8c97a]'}`}>
                      {sale.is_active ? 'Deactivate' : '🔥 Activate'}
                    </button>
                    <button onClick={async () => {
                      await supabase.from('sales_events').delete().eq('id', sale.id)
                      loadSalesEvents()
                    }} className="border border-red-400 text-red-400 font-bold py-2 px-4 rounded-xl text-sm hover:bg-red-500/10 transition-all">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* NEW SALE MODAL */}
          {showNewSale && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewSale(false)} />
              <div className={`relative w-full max-w-sm ${bg} border ${border} rounded-2xl p-6`}>
                <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-5">Create Sale Event</h2>

                <div className="mb-4">
                  <label className={`text-xs font-bold ${text3} block mb-1 uppercase tracking-wider`}>Sale Title</label>
                  <input type="text" placeholder="e.g. Memorial Day Sale 🇺🇸" value={saleTitle}
                    onChange={e => setSaleTitle(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c] ${input}`} />
                </div>

                <div className="mb-4">
                  <label className={`text-xs font-bold ${text3} block mb-2 uppercase tracking-wider`}>Discount Type</label>
                  <div className="flex gap-2">
                    {[{label: '% Percent Off', value: 'percent'}, {label: '$ Dollar Off', value: 'dollar'}].map(opt => (
                      <button key={opt.value} onClick={() => setSaleDiscountType(opt.value as any)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${saleDiscountType === opt.value ? 'bg-[#1a1a1a] text-[#f5f0e8] border-[#1a1a1a]' : `${border} ${text2}`}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className={`text-xs font-bold ${text3} block mb-1 uppercase tracking-wider`}>
                    {saleDiscountType === 'percent' ? 'Percentage Off' : 'Dollar Amount Off'}
                  </label>
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold ${text3}`}>{saleDiscountType === 'percent' ? '%' : '$'}</span>
                    <input type="number" placeholder="10" value={saleDiscountValue}
                      onChange={e => setSaleDiscountValue(e.target.value)}
                      className={`w-full border rounded-xl pl-8 pr-4 py-3 text-sm outline-none focus:border-[#c9a84c] ${input}`} />
                  </div>
                </div>

                <div className="mb-6">
                  <label className={`text-xs font-bold ${text3} block mb-2 uppercase tracking-wider`}>Applies To</label>
                  <div className="flex gap-2">
                    {[{label: 'Entire Order', value: 'all'}, {label: '🌿 Flower', value: 'flower'}, {label: '🚬 Pre-Rolls', value: 'prerolls'}].map(opt => (
                      <button key={opt.value} onClick={() => setSaleAppliesTo(opt.value as any)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${saleAppliesTo === opt.value ? 'bg-[#1a1a1a] text-[#f5f0e8] border-[#1a1a1a]' : `${border} ${text2}`}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowNewSale(false)} className={`flex-1 border ${border} ${text2} font-bold py-3 rounded-xl hover:border-[#c9a84c] transition-all`}>Cancel</button>
                  <button disabled={!saleTitle || !saleDiscountValue || savingSale}
                    onClick={async () => {
                      setSavingSale(true)
                      const { error } = await supabase.from('sales_events').insert({
                        title: saleTitle,
                        discount_type: saleDiscountType,
                        discount_value: Number(saleDiscountValue),
                        applies_to: saleAppliesTo,
                        is_active: false
                      })
                      if (error) { alert('Error: ' + error.message); setSavingSale(false); return }
                      setSaleTitle('')
                      setSaleDiscountValue('')
                      setSaleDiscountType('percent')
                      setSaleAppliesTo('all')
                      setSavingSale(false)
                      setShowNewSale(false)
                      loadSalesEvents()
                    }}
                    className="flex-1 bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all disabled:opacity-50">
                    {savingSale ? 'Saving...' : 'Create Sale'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <div className="px-4 pb-24 max-w-2xl mx-auto pt-6">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-4">Customer Lookup</h2>
          <div className="flex gap-2 mb-6">
            <input type="text" placeholder="Search by name or phone..." value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') searchCustomers() }}
              className={`flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#c9a84c] ${input}`} />
            <button onClick={searchCustomers} disabled={loadingCustomers}
              className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-5 py-3 rounded-xl text-sm hover:bg-[#333] transition-all disabled:opacity-50">
              {loadingCustomers ? '...' : 'Search'}
            </button>
          </div>
          {!selectedCustomer ? (
            <div className="flex flex-col gap-3">
              {customers.length === 0 && customerSearch && !loadingCustomers && (
                <div className={`text-center ${text3} py-10`}>
                  <div className="text-3xl mb-2">🔍</div>
                  <p>No customers found</p>
                </div>
              )}
              {customers.map((c: any) => (
                <div key={c.id} onClick={async () => { setSelectedCustomer(c); await loadCustomerOrders(c.customer_phone) }}
                  className={`${bg2} border ${border} rounded-2xl p-4 cursor-pointer hover:border-[#c9a84c] transition-all`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div style={{fontFamily: 'Georgia, serif'}} className="font-bold">{c.customer_name}</div>
                      <div className={`${text3} text-xs`}>{c.customer_phone}</div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${c.membership_tier === 'house' ? 'bg-[#1a1a1a] text-[#c9a84c]' : c.membership_tier === 'member' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.membership_tier === 'house' ? 'The House' : c.membership_tier === 'member' ? 'Member' : 'Guest'}
                    </span>
                  </div>
                  <div className={`flex gap-4 text-xs ${text3}`}>
                    <span>⭐ {c.points || 0} points</span>
                    <span>🛒 {c.purchase_count || 0} orders</span>
                    <span>💰 ${(c.total_spent || 0).toFixed(0)} spent</span>
                    {c.referral_count > 0 && <span>🎁 {c.referral_count} referrals</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerOrders([]) }}
                className={`${text3} text-sm mb-4 flex items-center gap-1 hover:text-[#c9a84c]`}>← Back to results</button>
              <div className="bg-[#1a1a1a] text-[#f5f0e8] rounded-2xl p-5 mb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold">{selectedCustomer.customer_name}</div>
                    <a href={`tel:${selectedCustomer.customer_phone}`} className="text-[#c9a84c] text-sm font-bold">📞 {selectedCustomer.customer_phone}</a>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${selectedCustomer.membership_tier === 'house' ? 'bg-[#c9a84c]/20 text-[#c9a84c]' : selectedCustomer.membership_tier === 'member' ? 'bg-green-900/30 text-green-400' : 'bg-white/10 text-[#999]'}`}>
                    {selectedCustomer.membership_tier === 'house' ? '👑 The House' : selectedCustomer.membership_tier === 'member' ? '✓ Member' : 'Guest'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-[#c9a84c] text-xl font-bold">{selectedCustomer.points || 0}</div><div className="text-[#999] text-xs">Points</div></div>
                  <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-xl font-bold">{selectedCustomer.purchase_count || 0}</div><div className="text-[#999] text-xs">Orders</div></div>
                  <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-xl font-bold">${(selectedCustomer.total_spent || 0).toFixed(0)}</div><div className="text-[#999] text-xs">Spent</div></div>
                </div>
                <div className="flex flex-col gap-1 text-xs text-[#999]">
                  {selectedCustomer.referral_code && <span>🔗 Referral code: <span className="text-[#c9a84c] font-mono font-bold">{selectedCustomer.referral_code}</span></span>}
                  {selectedCustomer.referred_by && <span>👥 Referred by: <span className="font-bold text-[#f5f0e8]">{selectedCustomer.referred_by}</span></span>}
                  {selectedCustomer.referral_count > 0 && <span>🎁 Referrals: <span className="font-bold text-[#f5f0e8]">{selectedCustomer.referral_count}</span></span>}
                  {selectedCustomer.pending_referral_reward && <span>⏳ Pending reward: <span className="font-bold text-[#c9a84c]">{selectedCustomer.pending_referral_reward}</span></span>}
                  {selectedCustomer.email && <span>📧 {selectedCustomer.email}</span>}
                  {selectedCustomer.birthday && <span>🎂 {selectedCustomer.birthday}</span>}
                  {selectedCustomer.house_paid_until && <span>💳 House paid until: {selectedCustomer.house_paid_until}</span>}
                </div>
              </div>
              <h3 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-3">Order History</h3>
              {customerOrders.length === 0 ? (
                <div className={`text-center ${text3} py-8 ${bg2} border ${border} rounded-2xl`}><p>No orders yet</p></div>
              ) : (
                <div className="flex flex-col gap-3">
                  {customerOrders.map((order: any) => (
                    <div key={order.id} className={`${bg2} border ${border} rounded-2xl p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`text-xs ${text3}`}>{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{order.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div className={`text-xs ${text2} mb-2`}>{Array.isArray(order.items) ? order.items.map((i: any) => `${i.emoji} ${i.name} x${i.qty}`).join(', ') : ''}</div>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs ${text3}`}>{order.customer_address === 'PICKUP' ? '📍 Pickup' : '🚗 Delivery'}</span>
                        <span className="font-bold text-[#c9a84c]">${order.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PICKUP LOCATION MANAGER */}
      {showPickupManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPickupManager(false)} />
          <div className={`relative w-full max-w-md ${bg} border ${border} rounded-2xl max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between px-6 py-5 border-b ${border}`}>
              <h2 style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg">Pickup Locations</h2>
              <button onClick={() => setShowPickupManager(false)} className={`${text3} text-2xl leading-none`}>×</button>
            </div>
            <div className="p-5">
              {/* EXISTING LOCATIONS */}
              {['Manhattan', 'Brooklyn'].map(borough => (
                <div key={borough} className="mb-5">
                  <div className={`text-xs font-bold uppercase tracking-widest ${text3} mb-2`}>{borough}</div>
                  <div className="flex flex-col gap-2">
                    {pickupLocations.filter(l => l.borough === borough).map(loc => (
                      <div key={loc.id} className={`${bg2} border ${loc.is_active ? 'border-[#c9a84c]/40' : border} rounded-xl p-3 flex items-start justify-between gap-2`}>
                        <div className="flex-1">
                          <p className="font-bold text-sm">{loc.address}</p>
                          {loc.description && <p className={`text-xs ${text3}`}>{loc.description}</p>}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={async () => {
                            await supabase.from('pickup_locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
                            loadPickupLocations()
                          }} className={`text-xs font-bold px-2 py-1 rounded-lg border transition-all ${loc.is_active ? 'border-green-400 text-green-500' : `${border} ${text3}`}`}>
                            {loc.is_active ? '✓ On' : 'Off'}
                          </button>
                          <button onClick={async () => {
                            await supabase.from('pickup_locations').delete().eq('id', loc.id)
                            loadPickupLocations()
                          }} className="text-xs font-bold px-2 py-1 rounded-lg border border-red-400 text-red-400 hover:bg-red-500/10 transition-all">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {pickupLocations.filter(l => l.borough === borough).length === 0 && (
                      <p className={`text-xs ${text3}`}>No locations for {borough} yet</p>
                    )}
                  </div>
                </div>
              ))}

              {/* ADD NEW LOCATION */}
              <div className={`border-t ${border} pt-4 mt-4`}>
                <p className={`text-xs font-bold uppercase tracking-widest ${text3} mb-3`}>Add New Location</p>
                <div className="flex gap-2 mb-3">
                  {['Manhattan', 'Brooklyn'].map(b => (
                    <button key={b} onClick={() => setNewBorough(b)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newBorough === b ? 'bg-[#1a1a1a] text-[#f5f0e8] border-[#1a1a1a]' : `${border} ${text2}`}`}>
                      {b}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Address (e.g. 125th St & Lex)" value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm mb-2 outline-none focus:border-[#c9a84c] ${input}`} />
                <input type="text" placeholder="Description (e.g. Near 4/5/6 train)" value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] ${input}`} />
                <button disabled={!newAddress || savingLocation} onClick={async () => {
                  setSavingLocation(true)
                  await supabase.from('pickup_locations').insert({ borough: newBorough, address: newAddress, description: newDescription, is_active: true })
                  setNewAddress('')
                  setNewDescription('')
                  setSavingLocation(false)
                  loadPickupLocations()
                }} className="w-full bg-[#c9a84c] text-[#1a1a1a] font-bold py-3 rounded-xl text-sm hover:bg-[#e8c97a] transition-all disabled:opacity-50">
                  {savingLocation ? 'Saving...' : '+ Add Location'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className={`relative w-full max-w-md ${bg} border ${border} rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between px-6 py-5 border-b ${border}`}>
              <h2 style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg">Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className={`${text3} text-2xl leading-none hover:text-[#c9a84c]`}>×</button>
            </div>
            <div className="p-6">
              <div className={`${bg2} border ${border} rounded-2xl p-4 mb-4`}>
                <div className={`${text3} text-xs font-bold uppercase tracking-wider mb-3`}>Customer</div>
                <div style={{fontFamily: 'Georgia, serif'}} className="font-bold text-lg mb-1">{selectedOrder.customer_name}</div>
                <a href={`tel:${selectedOrder.customer_phone}`} className="text-[#c9a84c] text-sm mb-1 block font-bold">📞 {selectedOrder.customer_phone}</a>
                {(selectedOrder as any).cash_tag && (
                  <a href={`https://cash.app/$${(selectedOrder as any).cash_tag}`} target="_blank" rel="noopener noreferrer"
                    className="text-green-500 text-sm font-bold block mb-1">
                    💚 ${(selectedOrder as any).cash_tag}
                  </a>
                )}
                {selectedOrder.customer_address === 'PICKUP' ? (
                  <div className={`${text2} text-sm`}>📍 Pickup order — send them location</div>
                ) : (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedOrder.customer_address)}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm block">📍 {selectedOrder.customer_address}</a>
                )}
                {(selectedOrder as any).referral_code && (
                  <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400">
                    <p className="font-bold mb-1">🎁 Referral code: <span className="font-mono">{(selectedOrder as any).referral_code}</span></p>
                    {(selectedOrder as any).referral_reward && (
                      <p className="text-xs">{(selectedOrder as any).referral_reward === 'Claim Later' ? '⏳ Customer chose to claim their free mini pre-roll later via Rewards page' : `✓ Include in this order: ${(selectedOrder as any).referral_reward}`}</p>
                    )}
                  </div>
                )}
              </div>
              <div className={`${bg2} border ${border} rounded-2xl p-4 mb-4`}>
                <div className={`${text3} text-xs font-bold uppercase tracking-wider mb-3`}>Items Ordered</div>
                {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center mb-2">
                    <span className={`text-sm ${text}`}>{item.emoji} {item.name} x {item.qty}</span>
                    <span className="text-[#c9a84c] font-bold text-sm">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className={`border-t ${border} mt-3 pt-3 flex justify-between font-bold`}>
                  <span>Total</span>
                  <span className="text-[#c9a84c]">${selectedOrder.total}</span>
                </div>
              </div>
              <div className={`${bg2} border ${border} rounded-2xl p-4 mb-4`}>
                <div className={`${text3} text-xs font-bold uppercase tracking-wider mb-3`}>Update Status</div>
                <div className="flex flex-col gap-2">
                  {STATUSES.map(s => (
                    <button key={s.value} onClick={() => updateStatus(selectedOrder.id, s.value)}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${selectedOrder.status === s.value ? 'bg-[#1a1a1a] text-[#f5f0e8]' : `${bg3} border ${border} ${text2} hover:border-[#c9a84c]`}`}>
                      {selectedOrder.status === s.value ? '✓ ' : ''}{s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`${text3} text-xs text-center`}>Order placed {formatTime(selectedOrder.created_at)}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}