'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ROLES = [
  { key: 'ceo', label: 'CEO', desc: 'Leadership & operations', suggested: 35 },
  { key: 'cfo', label: 'CFO', desc: 'Finance & accounting', suggested: 20 },
  { key: 'acquisitions', label: 'Acquisitions', desc: 'Product sourcing', suggested: 25 },
  { key: 'delivery', label: 'Delivery Runner', desc: 'Per delivery payout', suggested: 20 },
]

const PRICE_POINTS = [
  { label: '1g', grams: 1 },
  { label: '3.5g (1/8)', grams: 3.5 },
  { label: '7g (1/4)', grams: 7 },
  { label: '14g (1/2)', grams: 14 },
  { label: '28g (1oz)', grams: 28 },
  { label: '112g (QP)', grams: 112 },
]

export default function FinancePage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const [sales, setSales] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [activeWeek, setActiveWeek] = useState<any>(null)
  const [weekHistory, setWeekHistory] = useState<any[]>([])
  const [weekPayouts, setWeekPayouts] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [tab, setTab] = useState<'overview' | 'week' | 'history' | 'simulator'>('overview')
  const [showCloseWeek, setShowCloseWeek] = useState(false)
  const [showNewWeek, setShowNewWeek] = useState(false)
  const [carryoverGrams, setCarryoverGrams] = useState(0)
  const [closingWeek, setClosingWeek] = useState(false)
  const [productGrams, setProductGrams] = useState<Record<string, number>>({})
  const [newStrains, setNewStrains] = useState<any[]>([])
  const [deletedProducts, setDeletedProducts] = useState<string[]>([])
  const [reupFund, setReupFund] = useState<any>(null)
  const [reupGoal, setReupGoal] = useState(800)

  const [costPerQP, setCostPerQP] = useState(400)
  const [deliveryCost, setDeliveryCost] = useState(10)
  const [prices, setPrices] = useState<Record<string, number>>({
    '1g': 20, '3.5g (1/8)': 60, '7g (1/4)': 110,
    '14g (1/2)': 200, '28g (1oz)': 380, '112g (QP)': 1400,
  })
  const [splits, setSplits] = useState<Record<string, number>>({
    ceo: 35, cfo: 20, acquisitions: 25, delivery: 20,
  })
  const [saleGrams, setSaleGrams] = useState(3.5)
  const [salePrice, setSalePrice] = useState(60)
  const [numDeliveries, setNumDeliveries] = useState(1)

  useEffect(() => {
    if (authenticated) loadData()
  }, [authenticated])

  async function loadData() {
    setLoadingData(true)
    const [{ data: salesData }, { data: productsData }, { data: weeksData }] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*'),
      supabase.from('weeks').select('*').order('created_at', { ascending: false }),
    ])
    setSales(salesData || [])
    setProducts(productsData || [])
    const active = (weeksData || []).find((w: any) => w.status === 'active')
    setActiveWeek(active || null)
    setWeekHistory((weeksData || []).filter((w: any) => w.status === 'closed'))
    if (active) {
      const { data: payoutsData } = await supabase.from('week_payouts').select('*').eq('week_id', active.id)
      setWeekPayouts(payoutsData || [])
    }
    const { data: reupData } = await supabase.from('reup_fund').select('*').eq('status', 'active').maybeSingle()
    setReupFund(reupData || null)
    if (reupData) setReupGoal(reupData.goal)
    setLoadingData(false)
  }

  async function startNewWeek() {
    const weekNumber = weekHistory.length + 1
    const startDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const totalGrams = Object.values(productGrams).reduce((sum: number, g: any) => sum + (Number(g) || 0), 0)

    for (const newStrain of newStrains) {
      if (newStrain.name && newStrain.grams) {
        const { data: inserted } = await supabase.from('products').insert({
          name: newStrain.name, category: 'Flower', price: 40, thc: '—',
          strain_type: 'Hybrid', description: 'New strain', emoji: '🌿',
          in_stock: true, stock_grams: Number(newStrain.grams)
        }).select().single()
        if (inserted) productGrams[inserted.id] = Number(newStrain.grams)
      }
    }

    for (const id of deletedProducts) {
      await supabase.from('products').delete().eq('id', id)
    }

    const { data: newWeek } = await supabase.from('weeks').insert({
      week_number: weekNumber, start_date: startDate, end_date: '',
      carried_over_grams: carryoverGrams, new_grams_added: totalGrams, status: 'active'
    }).select().single()

    for (const product of products.filter((p: any) => p.category !== 'Pre-Rolls' && !deletedProducts.includes(p.id))) {
      await supabase.from('products').update({ stock_grams: Number(productGrams[product.id]) || 0 }).eq('id', product.id)
    }

    // Set up Re-Up fund for this week
    if (reupFund) {
      await supabase.from('reup_fund').update({
        goal: reupGoal, current_balance: 0, status: 'active', week_id: newWeek?.id || null
      }).eq('id', reupFund.id)
    } else {
      await supabase.from('reup_fund').insert({
        goal: reupGoal, current_balance: 0, status: 'active', week_id: newWeek?.id || null
      })
    }

    setShowNewWeek(false)
    setProductGrams({})
    setNewStrains([])
    setDeletedProducts([])
    await loadData()
  }

  async function closeWeek() {
    if (!activeWeek) return
    setClosingWeek(true)
    const weekSales = sales.filter((s: any) => s.week_id === activeWeek.id)
    const totalRevenue = weekSales.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0)
    const totalProfit = weekSales.reduce((sum: number, s: any) => sum + (s.net_profit || 0), 0)
    const totalDelivery = weekSales.reduce((sum: number, s: any) => sum + (s.delivery_cost || 0), 0)
    const totalGramsSold = weekSales.reduce((sum: number, s: any) => sum + (s.grams_sold || 0), 0)
    const endDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    let reupContribution = 0
    let teamPayoutProfit = 0

    if (reupFund && reupFund.status !== 'completed') {
      const currentBalance = reupFund.current_balance || 0
      const goal = reupFund.goal || 800
      const needed = Math.max(0, goal - currentBalance)
      if (totalProfit <= needed) {
        reupContribution = totalProfit
        teamPayoutProfit = 0
      } else {
        reupContribution = needed
        teamPayoutProfit = totalProfit - needed
      }
      const newBalance = currentBalance + reupContribution
      await supabase.from('reup_fund').update({
        current_balance: newBalance,
        status: newBalance >= goal ? 'completed' : 'active'
      }).eq('id', reupFund.id)
    } else {
      teamPayoutProfit = totalProfit
    }

    await supabase.from('weeks').update({
      end_date: endDate, total_revenue: totalRevenue, total_profit: totalProfit,
      total_delivery_costs: totalDelivery, total_grams_sold: totalGramsSold, status: 'closed'
    }).eq('id', activeWeek.id)

    for (const role of ROLES) {
      const grossPayout = (teamPayoutProfit * splits[role.key]) / 100
      const deliveryContribution = (totalDelivery * splits[role.key]) / 100
      await supabase.from('week_payouts').insert({
        week_id: activeWeek.id, role: role.key,
        gross_payout: grossPayout, delivery_contribution: deliveryContribution,
        net_payout: grossPayout - deliveryContribution
      })
    }

    const totalStartGrams = (activeWeek.new_grams_added || 0) + (activeWeek.carried_over_grams || 0)
    setCarryoverGrams(Math.max(0, totalStartGrams - totalGramsSold))
    setClosingWeek(false)
    setShowCloseWeek(false)
    setShowNewWeek(true)
    await loadData()
  }

  const totalSplit = Object.values(splits).reduce((a, b) => a + b, 0)
  const costPerGram = costPerQP / 112
  const weekSales = activeWeek ? sales.filter((s: any) => String(s.week_id) === String(activeWeek.id)) : []
  const weekRevenue = weekSales.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0)
  const weekProfit = weekSales.reduce((sum: number, s: any) => sum + (s.net_profit || 0), 0)
  const weekDelivery = weekSales.reduce((sum: number, s: any) => sum + (s.delivery_cost || 0), 0)
  const weekGramsSold = weekSales.reduce((sum: number, s: any) => sum + (s.grams_sold || 0), 0)
  const totalRevenue = sales.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0)
  const totalProfit = sales.reduce((sum: number, s: any) => sum + (s.net_profit || 0), 0)

  const reupNeeded = reupFund ? Math.max(0, (reupFund.goal || 800) - (reupFund.current_balance || 0)) : 0
  const weekSurplus = reupFund && reupFund.status !== 'completed' ? Math.max(0, weekProfit - reupNeeded) : weekProfit
  const weekToReup = reupFund && reupFund.status !== 'completed' ? Math.min(weekProfit, reupNeeded) : 0

  const projectedPayouts: Record<string, any> = {}
  ROLES.forEach(r => {
    const gross = (weekSurplus * splits[r.key]) / 100
    const deliveryShare = (weekDelivery * splits[r.key]) / 100
    projectedPayouts[r.key] = { gross, deliveryShare, net: gross - deliveryShare }
  })

  const grossRevenue = salePrice
  const totalDeliveryCost = deliveryCost * numDeliveries
  const inventoryCost = costPerGram * saleGrams
  const netProfit = grossRevenue - totalDeliveryCost - inventoryCost
  const profitMargin = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0'
  const simPayouts: Record<string, number> = {}
  ROLES.forEach(r => { simPayouts[r.key] = (netProfit * splits[r.key]) / 100 })

  const priceAnalysis = PRICE_POINTS.map(pp => {
    const price = prices[pp.label] || 0
    const cost = costPerGram * pp.grams
    const profit = price - cost - deliveryCost
    const margin = price > 0 ? ((profit / price) * 100).toFixed(1) : '0'
    return { ...pp, price, cost, profit, margin, unitsFromQP: Math.floor(112 / pp.grams), totalProfitFromQP: profit * Math.floor(112 / pp.grams) }
  })

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-1">LUCKY DAYZE</div>
            <div className="text-xs tracking-widest uppercase text-[#999]">Finance Dashboard</div>
          </div>
          <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-6">Enter Password</h2>
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { if (password === 'luckypayze2025') { setAuthenticated(true); setWrongPassword(false) } else setWrongPassword(true) } }}
              className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]" />
            {wrongPassword && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <button onClick={() => { if (password === 'luckypayze2025') { setAuthenticated(true); setWrongPassword(false) } else setWrongPassword(true) }}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all">Login</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]/10 sticky top-0 bg-[#f5f0e8]/95 backdrop-blur z-40">
        <div>
          <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold tracking-wider">LUCKY DAYZE</div>
          <div className="text-xs tracking-widest uppercase text-[#999]">Finance Dashboard</div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="border border-[#1a1a1a]/20 text-[#666] text-sm font-bold px-4 py-2 rounded-full hover:border-[#1a1a1a] transition-all">Refresh</button>
          <a href="/admin" className="bg-[#1a1a1a] text-[#f5f0e8] text-sm font-bold px-5 py-2 rounded-full hover:bg-[#333] transition-all">Admin</a>
          <a href="/" className="border border-[#1a1a1a]/20 text-[#666] text-sm font-bold px-4 py-2 rounded-full hover:border-[#1a1a1a] transition-all">Store</a>
        </div>
      </nav>

      <div className="flex gap-2 px-6 py-4 border-b border-[#1a1a1a]/10 overflow-x-auto">
        {(['overview', 'week', 'history', 'simulator'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all capitalize ${tab === t ? 'bg-[#1a1a1a] text-[#f5f0e8]' : 'border border-[#1a1a1a]/20 text-[#666]'}`}>
            {t === 'week' ? 'This Week' : t}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {tab === 'overview' && (
          <>
            <div className="bg-[#1a1a1a] text-[#f5f0e8] rounded-2xl p-6 mb-6">
              <div className="text-xs tracking-widest uppercase text-[#c9a84c] mb-4">All Time Stats</div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div><div className="text-[#999] text-xs mb-1">Total Revenue</div><div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold text-[#c9a84c]">${totalRevenue.toFixed(2)}</div></div>
                <div><div className="text-[#999] text-xs mb-1">Net Profit</div><div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold">${totalProfit.toFixed(2)}</div></div>
                <div><div className="text-[#999] text-xs mb-1">Weeks Completed</div><div className="text-xl font-bold">{weekHistory.length}</div></div>
                <div><div className="text-[#999] text-xs mb-1">Total Orders</div><div className="text-xl font-bold">{[...new Set(sales.map((s: any) => s.order_id))].length}</div></div>
              </div>
              <div className="border-t border-white/10 pt-5">
                <div className="text-xs tracking-widest uppercase text-[#c9a84c] mb-4">All Time Payouts by Role</div>
                {ROLES.map(role => {
                  const allTimeGross = weekHistory.reduce((sum: number, week: any) => {
                    const wp = weekPayouts.find((p: any) => p.week_id === week.id && p.role === role.key)
                    return sum + (wp?.gross_payout || 0)
                  }, 0)
                  const allTimeDelivery = weekHistory.reduce((sum: number, week: any) => {
                    const wp = weekPayouts.find((p: any) => p.week_id === week.id && p.role === role.key)
                    return sum + (wp?.delivery_contribution || 0)
                  }, 0)
                  const allTimeNet = allTimeGross - allTimeDelivery
                  return (
                    <div key={role.key} className="mb-4 pb-4 border-b border-white/10 last:border-0 last:mb-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div><span className="font-bold">{role.label}</span><span className="text-[#999] text-xs ml-2">{role.desc}</span></div>
                        <span className="text-[#c9a84c] font-bold text-lg">${allTimeNet.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-[#999]">Gross: <span className="text-[#f5f0e8]/80 font-bold">${allTimeGross.toFixed(2)}</span></span>
                        <span className="text-[#999]">Delivery: <span className="text-red-400 font-bold">−${allTimeDelivery.toFixed(2)}</span></span>
                        <span className="text-[#999]">Net: <span className="text-green-400 font-bold">${allTimeNet.toFixed(2)}</span></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
              <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">Inventory Status</h2>
              <div className="flex flex-col gap-3">
                {products.filter((p: any) => p.category !== 'Pre-Rolls').map((p: any) => {
                  const stockPct = Math.max(0, Math.min(100, ((p.stock_grams || 0) / 112) * 100))
                  const isLow = (p.stock_grams || 0) < 14
                  return (
                    <div key={p.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold">{p.name}</span>
                        <span className={`font-bold ${isLow ? 'text-red-500' : 'text-green-600'}`}>{isLow ? '⚠ Low — ' : '✓ '}{(p.stock_grams || 0).toFixed(1)}g left</span>
                      </div>
                      <div className="h-2 bg-[#f0ebe0] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${isLow ? 'bg-red-400' : 'bg-[#c9a84c]'}`} style={{ width: `${stockPct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {tab === 'week' && (
          <>
            {reupFund && (
              <div className="bg-[#1a1a1a] text-[#f5f0e8] rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs tracking-widest uppercase text-[#c9a84c] mb-1">Re-Up Fund</div>
                    <div style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold">{reupFund.status === 'completed' ? '🎉 Goal Reached!' : 'Building Fund...'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#c9a84c] text-2xl font-bold">${(reupFund.current_balance || 0).toFixed(0)}</div>
                    <div className="text-[#999] text-xs">of ${reupFund.goal} goal</div>
                  </div>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-[#c9a84c] rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((reupFund.current_balance || 0) / reupFund.goal) * 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-[#999]">
                  <span>${Math.max(0, reupFund.goal - (reupFund.current_balance || 0)).toFixed(0)} still needed</span>
                  <span>{Math.min(100, Math.round(((reupFund.current_balance || 0) / reupFund.goal) * 100))}% funded</span>
                </div>
                {reupFund.status === 'completed' && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-[#c9a84c] text-sm font-bold">🎉 Re-Up goal met! Start a new week to set a new goal.</p>
                  </div>
                )}
              </div>
            )}

            {!activeWeek ? (
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-8 text-center mb-6">
                <div className="text-4xl mb-4">📅</div>
                <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-2">No Active Week</h2>
                <p className="text-[#999] text-sm mb-6">Start a new week to begin tracking sales and payouts.</p>
                <button onClick={() => setShowNewWeek(true)} className="bg-[#1a1a1a] text-[#f5f0e8] font-bold px-8 py-3 rounded-full hover:bg-[#333] transition-all">Start Week</button>
              </div>
            ) : (
              <>
                <div className="bg-[#1a1a1a] text-[#f5f0e8] rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs tracking-widest uppercase text-[#c9a84c] mb-1">Week {activeWeek.week_number}</div>
                      <div className="text-sm text-[#999]">Started {activeWeek.start_date}</div>
                    </div>
                    <button onClick={() => setShowCloseWeek(true)} className="bg-[#c9a84c] text-[#1a1a1a] font-bold px-5 py-2 rounded-full text-sm hover:bg-[#e8c97a] transition-all">Close Week</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><div className="text-[#999] text-xs mb-1">Revenue This Week</div><div className="text-2xl font-bold text-[#c9a84c]">${weekRevenue.toFixed(2)}</div></div>
                    <div><div className="text-[#999] text-xs mb-1">Profit This Week</div><div className="text-2xl font-bold">${weekProfit.toFixed(2)}</div></div>
                    <div><div className="text-[#999] text-xs mb-1">Grams Sold</div><div className="text-xl font-bold">{weekGramsSold.toFixed(1)}g</div></div>
                    <div><div className="text-[#999] text-xs mb-1">Delivery Costs</div><div className="text-xl font-bold text-red-400">${weekDelivery.toFixed(2)}</div></div>
                  </div>
                  {reupFund && reupFund.status !== 'completed' && (
                    <div className="bg-white/5 rounded-xl p-3 mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#999]">Goes to Re-Up Fund</span>
                        <span className="text-[#c9a84c] font-bold">${weekToReup.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#999]">Available for team</span>
                        <span className="font-bold">${weekSurplus.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-xs text-[#999] uppercase tracking-wider mb-3">Projected Payouts</div>
                    {ROLES.map(role => (
                      <div key={role.key} className="flex justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                        <div><span className="font-bold">{role.label}</span><span className="text-[#999] text-xs ml-2">−${projectedPayouts[role.key]?.deliveryShare.toFixed(2)} delivery</span></div>
                        <span className="font-bold text-[#c9a84c]">${projectedPayouts[role.key]?.net.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
                  <h3 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">This Week's Sales</h3>
                  {weekSales.length === 0 ? (
                    <p className="text-[#999] text-sm text-center py-4">No sales this week yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {weekSales.map((sale: any) => (
                        <div key={sale.id} className="py-3 border-b border-[#e0d9cc] last:border-0">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <div><div className="font-bold">{sale.product_name}</div><div className="text-[#999] text-xs">{sale.grams_sold}g · {new Date(sale.created_at).toLocaleDateString()}</div></div>
                            <div className="text-right"><div className="font-bold">${sale.revenue?.toFixed(2)}</div><div className="text-green-600 text-xs">+${sale.net_profit?.toFixed(2)} profit</div></div>
                          </div>
                          {sale.delivery_shares && (
                            <div className="bg-[#f5f0e8] rounded-xl p-3">
                              <div className="text-xs text-[#999] uppercase tracking-wider mb-2">Delivery split — ${sale.delivery_cost?.toFixed(2)}</div>
                              <div className="flex flex-col gap-1">
                                {Object.entries(sale.delivery_shares).map(([role, amount]: any) => (
                                  <div key={role} className="flex justify-between text-xs border-b border-[#e0d9cc] last:border-0 py-1">
                                    <span className="text-[#666] capitalize">{role}</span>
                                    <span className="font-bold text-red-500">−${amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold">Profit Split</h2>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${totalSplit === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {totalSplit}% {totalSplit === 100 ? '✓' : '— adjust'}
                    </span>
                  </div>
                  {ROLES.map(role => (
                    <div key={role.key} className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{role.label}</span>
                        <span className="text-[#c9a84c] font-bold">{splits[role.key]}%</span>
                      </div>
                      <input type="range" min="0" max="70" value={splits[role.key]}
                        onChange={e => setSplits(prev => ({ ...prev, [role.key]: Number(e.target.value) }))}
                        className="w-full accent-[#c9a84c]" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-2xl font-bold mb-6">Week History</h2>
            {weekHistory.length === 0 ? (
              <div className="bg-white border border-[#e0d9cc] rounded-2xl p-8 text-center">
                <div className="text-4xl mb-4">📚</div>
                <p className="text-[#999] text-sm">No completed weeks yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {weekHistory.map((week: any) => (
                  <div key={week.id} className="bg-white border border-[#e0d9cc] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold">Week {week.week_number}</div>
                        <div className="text-xs text-[#999]">{week.start_date} → {week.end_date}</div>
                      </div>
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">Closed</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#f5f0e8] rounded-xl p-3"><div className="text-xs text-[#999] mb-1">Revenue</div><div className="font-bold text-[#c9a84c]">${week.total_revenue?.toFixed(2)}</div></div>
                      <div className="bg-[#f5f0e8] rounded-xl p-3"><div className="text-xs text-[#999] mb-1">Net Profit</div><div className="font-bold">${week.total_profit?.toFixed(2)}</div></div>
                      <div className="bg-[#f5f0e8] rounded-xl p-3"><div className="text-xs text-[#999] mb-1">Grams Sold</div><div className="font-bold">{week.total_grams_sold?.toFixed(1)}g</div></div>
                      <div className="bg-[#f5f0e8] rounded-xl p-3"><div className="text-xs text-[#999] mb-1">Delivery Costs</div><div className="font-bold text-red-500">${week.total_delivery_costs?.toFixed(2)}</div></div>
                    </div>
                    <WeekPayouts weekId={week.id} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'simulator' && (
          <>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
              <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">Sale Simulator</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div><label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Grams Sold</label><input type="number" value={saleGrams} onChange={e => setSaleGrams(Number(e.target.value))} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]" /></div>
                <div><label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Sale Price ($)</label><input type="number" value={salePrice} onChange={e => setSalePrice(Number(e.target.value))} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]" /></div>
                <div><label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Delivery Cost ($)</label><input type="number" value={deliveryCost} onChange={e => setDeliveryCost(Number(e.target.value))} className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]" /></div>
              </div>
              <div className="bg-[#f5f0e8] rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between"><span className="text-[#999]">Gross Revenue</span><span className="font-bold">${grossRevenue.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-[#999]">Inventory Cost</span><span className="font-bold text-red-500">−${inventoryCost.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-[#999]">Delivery Cost</span><span className="font-bold text-red-500">−${totalDeliveryCost.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-[#999]">Profit Margin</span><span className="font-bold text-green-600">{profitMargin}%</span></div>
                </div>
                <div className="border-t border-[#e0d9cc] mt-3 pt-3 flex justify-between font-bold">
                  <span>Net Profit</span><span className="text-[#c9a84c] text-lg">${netProfit.toFixed(2)}</span>
                </div>
              </div>
              <h3 className="font-bold text-sm mb-3">Individual Payouts</h3>
              <div className="flex flex-col gap-2">
                {ROLES.map(role => (
                  <div key={role.key} className="flex items-center justify-between py-2 border-b border-[#e0d9cc] last:border-0">
                    <span className="font-bold text-sm">{role.label}</span>
                    <span className="font-bold text-green-600">${simPayouts[role.key].toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
              <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">Price Point Analysis</h2>
              <div className="flex flex-col gap-3">
                {priceAnalysis.map(pp => (
                  <div key={pp.label} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-bold">{pp.label}</div>
                    <input type="number" value={prices[pp.label]} onChange={e => setPrices(prev => ({ ...prev, [pp.label]: Number(e.target.value) }))} className="w-24 bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]" />
                    <div className="flex-1 h-2 bg-[#f0ebe0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#c9a84c] rounded-full" style={{ width: `${Math.max(0, Math.min(100, parseFloat(pp.margin)))}%` }} />
                    </div>
                    <div className="text-right min-w-[80px]">
                      <div className={`text-sm font-bold ${parseFloat(pp.margin) > 40 ? 'text-green-600' : parseFloat(pp.margin) > 20 ? 'text-amber-600' : 'text-red-500'}`}>{pp.margin}%</div>
                      <div className="text-xs text-[#999]">${pp.profit.toFixed(0)} profit</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* NEW WEEK MODAL */}
      {showNewWeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewWeek(false)} />
          <div className="relative w-full max-w-sm bg-[#f5f0e8] border border-[#e0d9cc] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-2">Start New Week</h2>
            <p className="text-[#999] text-sm mb-5">Set your inventory and Re-Up goal for this week.</p>

            {/* RE-UP GOAL INPUT */}
            <div className="bg-[#1a1a1a] text-[#f5f0e8] rounded-2xl p-4 mb-5">
              <div className="text-xs tracking-widest uppercase text-[#c9a84c] mb-2">Re-Up Goal</div>
              <p className="text-[#999] text-xs mb-3">All profit goes here first. Team gets paid once goal is met.</p>
              <input
                type="number"
                value={reupGoal}
                onChange={e => setReupGoal(Number(e.target.value))}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#c9a84c] text-[#f5f0e8] placeholder-[#999] mb-2"
                placeholder="800"
              />
              <div className="flex justify-between text-xs text-[#999]">
                <span>2 QPs = $800 recommended</span>
                <span className="text-[#c9a84c] font-bold">{(reupGoal / 400).toFixed(1)} QPs</span>
              </div>
            </div>

            {/* EXISTING PRODUCTS */}
            <div className="flex flex-col gap-3 mb-4">
              {products.filter((p: any) => p.category !== 'Pre-Rolls' && !deletedProducts.includes(p.id)).map((product: any) => (
                <div key={product.id}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-bold">{product.emoji} {product.name}</label>
                    <button onClick={() => setDeletedProducts(prev => [...prev, product.id])} className="text-xs text-red-400 hover:text-red-600 font-bold">Remove</button>
                  </div>
                  <input type="number" placeholder="0" value={productGrams[product.id] || ''}
                    onChange={e => setProductGrams(prev => ({ ...prev, [product.id]: Number(e.target.value) }))}
                    className="w-full bg-white border border-[#e0d9cc] rounded-xl px-4 py-2 text-sm outline-none focus:border-[#c9a84c]" />
                </div>
              ))}
            </div>

            {newStrains.map((strain, idx) => (
              <div key={idx} className="mb-3 bg-white border border-[#c9a84c]/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#c9a84c] uppercase tracking-wider">New Strain</span>
                  <button onClick={() => setNewStrains(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-600 font-bold">Remove</button>
                </div>
                <input type="text" placeholder="Strain name" value={strain.name}
                  onChange={e => setNewStrains(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                  className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm mb-2 outline-none focus:border-[#c9a84c]" />
                <input type="number" placeholder="Grams" value={strain.grams}
                  onChange={e => setNewStrains(prev => prev.map((s, i) => i === idx ? { ...s, grams: e.target.value } : s))}
                  className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]" />
              </div>
            ))}

            <button onClick={() => setNewStrains(prev => [...prev, { name: '', grams: '' }])}
              className="w-full border border-dashed border-[#c9a84c] text-[#c9a84c] font-bold py-2 rounded-xl text-sm hover:bg-[#c9a84c]/5 transition-all mb-4">
              + Add New Strain
            </button>

            {/* BREAKDOWN */}
            <div className="bg-white border border-[#e0d9cc] rounded-xl p-4 mb-4">
              <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Inventory Breakdown</div>
              {products.filter((p: any) => p.category !== 'Pre-Rolls' && !deletedProducts.includes(p.id)).map((product: any) => {
                const g = Number(productGrams[product.id] || 0)
                if (!g) return null
                return (
                  <div key={product.id} className="flex justify-between text-sm py-1 border-b border-[#e0d9cc] last:border-0">
                    <span className="font-bold">{product.emoji} {product.name}</span>
                    <span className="text-[#999]">{g}g · {(g/128).toFixed(2)}oz · {(g/512).toFixed(2)} QP</span>
                  </div>
                )
              })}
              {newStrains.filter(s => s.name && s.grams).map((s, i) => {
                const g = Number(s.grams)
                return (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-[#e0d9cc] last:border-0">
                    <span className="font-bold">🌿 {s.name}</span>
                    <span className="text-[#999]">{g}g · {(g/128).toFixed(2)}oz · {(g/512).toFixed(2)} QP</span>
                  </div>
                )
              })}
              <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-[#e0d9cc]">
                <span>Total</span>
                <span className="text-[#c9a84c]">
                  {(() => {
                    const totalG = [
                      ...products.filter((p: any) => p.category !== 'Pre-Rolls' && !deletedProducts.includes(p.id)).map((p: any) => Number(productGrams[p.id] || 0)),
                      ...newStrains.filter(s => s.grams).map(s => Number(s.grams))
                    ].reduce((a, b) => a + b, 0)
                    return `${totalG}g · ${(totalG/128).toFixed(2)}oz · ${(totalG/512).toFixed(2)} QP`
                  })()}
                </span>
              </div>
            </div>

            <button onClick={startNewWeek} className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all">Start Week</button>
          </div>
        </div>
      )}

      {/* CLOSE WEEK MODAL */}
      {showCloseWeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCloseWeek(false)} />
          <div className="relative w-full max-w-sm bg-[#f5f0e8] border border-[#e0d9cc] rounded-2xl p-6">
            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold mb-2">Close Week {activeWeek?.week_number}?</h2>
            <p className="text-[#999] text-sm mb-6">This will finalize all payouts and log the week permanently.</p>
            <div className="bg-white border border-[#e0d9cc] rounded-xl p-4 mb-6">
              {reupFund && reupFund.status !== 'completed' && (
                <>
                  <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Re-Up Fund First</div>
                  <div className="flex justify-between text-sm py-1.5 border-b border-[#e0d9cc]">
                    <span className="text-[#999]">Goes to Re-Up Fund</span>
                    <span className="font-bold text-[#c9a84c]">${weekToReup.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1.5 border-b border-[#e0d9cc] mb-3">
                    <span className="text-[#999]">Available for team</span>
                    <span className="font-bold">${weekSurplus.toFixed(2)}</span>
                  </div>
                  {weekSurplus === 0 && (
                    <p className="text-xs text-amber-600 mb-3">All profit goes to Re-Up this week. ${reupNeeded.toFixed(0)} still needed.</p>
                  )}
                  <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Team Payouts</div>
                </>
              )}
              {ROLES.map(role => (
                <div key={role.key} className="flex justify-between text-sm py-1.5 border-b border-[#e0d9cc] last:border-0">
                  <span className="font-bold">{role.label}</span>
                  <span className="font-bold text-[#c9a84c]">${projectedPayouts[role.key]?.net.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 mt-2 font-bold">
                <span>Total Paid Out</span>
                <span>${Object.values(projectedPayouts).reduce((sum: number, p: any) => sum + p.net, 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseWeek(false)} className="flex-1 border border-[#1a1a1a]/20 text-[#666] font-bold py-3 rounded-xl hover:border-[#1a1a1a] transition-all">Cancel</button>
              <button onClick={closeWeek} disabled={closingWeek} className="flex-1 bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all disabled:opacity-50">
                {closingWeek ? 'Closing...' : 'Close & Pay Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function WeekPayouts({ weekId }: { weekId: string }) {
  const [payouts, setPayouts] = useState<any[]>([])
  useEffect(() => {
    supabase.from('week_payouts').select('*').eq('week_id', weekId).then(({ data }) => setPayouts(data || []))
  }, [weekId])
  if (payouts.length === 0) return null
  return (
    <div className="border-t border-[#e0d9cc] pt-4">
      <div className="text-xs uppercase tracking-wider text-[#999] mb-3">Final Payouts</div>
      {payouts.map((p: any) => (
        <div key={p.id} className="flex justify-between text-sm py-1.5 border-b border-[#e0d9cc] last:border-0">
          <div><span className="font-bold capitalize">{p.role}</span><span className="text-[#999] text-xs ml-2">−${p.delivery_contribution?.toFixed(2)} delivery</span></div>
          <span className="font-bold text-[#c9a84c]">${p.net_payout?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}