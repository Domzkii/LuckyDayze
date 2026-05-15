'use client'

import { useState } from 'react'

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

  // Inventory inputs
  const [costPerQP, setCostPerQP] = useState(400)
  const [gramsAvailable, setGramsAvailable] = useState(112)
  const [deliveryCost, setDeliveryCost] = useState(10)

  // Pricing inputs
  const [prices, setPrices] = useState<Record<string, number>>({
    '1g': 20,
    '3.5g (1/8)': 60,
    '7g (1/4)': 110,
    '14g (1/2)': 200,
    '28g (1oz)': 380,
    '112g (QP)': 1400,
  })

  // Split inputs
  const [splits, setSplits] = useState<Record<string, number>>({
    ceo: 35,
    cfo: 20,
    acquisitions: 25,
    delivery: 20,
  })

  // Sale simulator
  const [saleGrams, setSaleGrams] = useState(3.5)
  const [salePrice, setSalePrice] = useState(60)
  const [numDeliveries, setNumDeliveries] = useState(1)

  const totalSplit = Object.values(splits).reduce((a, b) => a + b, 0)
  const costPerGram = costPerQP / 112

  // Finance calculations
  const grossRevenue = salePrice
  const totalDeliveryCost = deliveryCost * numDeliveries
  const inventoryCost = costPerGram * saleGrams
  const totalCosts = totalDeliveryCost + inventoryCost
  const netProfit = grossRevenue - totalCosts
  const profitMargin = ((netProfit / grossRevenue) * 100).toFixed(1)

  // Payouts
  const payouts: Record<string, number> = {}
  ROLES.forEach(r => {
    payouts[r.key] = (netProfit * splits[r.key]) / 100
  })

  // Price point analysis
  const priceAnalysis = PRICE_POINTS.map(pp => {
    const price = prices[pp.label] || 0
    const cost = costPerGram * pp.grams
    const profit = price - cost - deliveryCost
    const margin = price > 0 ? ((profit / price) * 100).toFixed(1) : '0'
    const unitsFromQP = Math.floor(112 / pp.grams)
    const totalProfitFromQP = profit * unitsFromQP
    return { ...pp, price, cost, profit, margin, unitsFromQP, totalProfitFromQP }
  })

  const bestMargin = [...priceAnalysis].sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin))[0]
  const bestRevenue = [...priceAnalysis].sort((a, b) => b.totalProfitFromQP - a.totalProfitFromQP)[0]

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
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (password === 'luckypayze2025') { setAuthenticated(true); setWrongPassword(false) }
                  else setWrongPassword(true)
                }
              }}
              className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]"
            />
            {wrongPassword && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <button
              onClick={() => {
                if (password === 'luckpayze2025') { setAuthenticated(true); setWrongPassword(false) }
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
          <div className="text-xs tracking-widest uppercase text-[#999]">Finance Dashboard</div>
        </div>
        <a href="/admin" className="bg-[#1a1a1a] text-[#f5f0e8] text-sm font-bold px-5 py-2 rounded-full hover:bg-[#333] transition-all">
          Admin
        </a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* AI SUGGESTIONS */}
        <div className="bg-[#1a1a1a] text-[#f5f0e8] rounded-2xl p-6 mb-8">
          <div className="text-xs tracking-widest uppercase text-[#c9a84c] mb-3">Optimal Strategy</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[#999] text-xs mb-1">Best Margin</div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold text-[#c9a84c]">{bestMargin.label}</div>
              <div className="text-sm text-[#f5f0e8]/70">{bestMargin.margin}% margin</div>
            </div>
            <div>
              <div className="text-[#999] text-xs mb-1">Best Total Profit/QP</div>
              <div style={{fontFamily: 'Georgia, serif'}} className="text-xl font-bold text-[#c9a84c]">{bestRevenue.label}</div>
              <div className="text-sm text-[#f5f0e8]/70">${bestRevenue.totalProfitFromQP.toFixed(0)} per QP</div>
            </div>
          </div>
        </div>

        {/* INVENTORY INPUTS */}
        <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">Inventory & Costs</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Cost per QP ($)</label>
              <input
                type="number"
                value={costPerQP}
                onChange={e => setCostPerQP(Number(e.target.value))}
                className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Grams Available</label>
              <input
                type="number"
                value={gramsAvailable}
                onChange={e => setGramsAvailable(Number(e.target.value))}
                className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Delivery Cost ($)</label>
              <input
                type="number"
                value={deliveryCost}
                onChange={e => setDeliveryCost(Number(e.target.value))}
                className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
              />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#e0d9cc] flex gap-6">
            <div>
              <div className="text-xs text-[#999]">Cost per gram</div>
              <div className="font-bold text-[#1a1a1a]">${costPerGram.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-[#999]">Grams remaining</div>
              <div className="font-bold text-[#1a1a1a]">{gramsAvailable}g</div>
            </div>
            <div>
              <div className="text-xs text-[#999]">Inventory value</div>
              <div className="font-bold text-[#c9a84c]">${(costPerGram * gramsAvailable).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* PRICE POINT ANALYSIS */}
        <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">Price Point Analysis</h2>
          <div className="flex flex-col gap-3">
            {priceAnalysis.map(pp => (
              <div key={pp.label} className="flex items-center gap-3">
                <div className="w-20 text-sm font-bold text-[#1a1a1a]">{pp.label}</div>
                <input
                  type="number"
                  value={prices[pp.label]}
                  onChange={e => setPrices(prev => ({ ...prev, [pp.label]: Number(e.target.value) }))}
                  className="w-24 bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
                />
                <div className="flex-1 h-2 bg-[#f0ebe0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#c9a84c] rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, parseFloat(pp.margin)))}%` }}
                  />
                </div>
                <div className="text-right min-w-[80px]">
                  <div className={`text-sm font-bold ${parseFloat(pp.margin) > 40 ? 'text-green-600' : parseFloat(pp.margin) > 20 ? 'text-amber-600' : 'text-red-500'}`}>
                    {pp.margin}%
                  </div>
                  <div className="text-xs text-[#999]">${pp.profit.toFixed(0)} profit</div>
                </div>
                <div className="text-right min-w-[80px]">
                  <div className="text-xs text-[#999]">{pp.unitsFromQP} units/QP</div>
                  <div className="text-xs font-bold text-[#1a1a1a]">${pp.totalProfitFromQP.toFixed(0)} total</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PROFIT SPLIT */}
        <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold">Profit Split</h2>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${totalSplit === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {totalSplit}% {totalSplit === 100 ? '✓' : totalSplit > 100 ? '— over by ' + (totalSplit - 100) + '%' : '— ' + (100 - totalSplit) + '% unallocated'}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {ROLES.map(role => (
              <div key={role.key}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="font-bold text-sm">{role.label}</span>
                    <span className="text-[#999] text-xs ml-2">{role.desc}</span>
                  </div>
                  <span className="text-[#c9a84c] font-bold">{splits[role.key]}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="70"
                  value={splits[role.key]}
                  onChange={e => setSplits(prev => ({ ...prev, [role.key]: Number(e.target.value) }))}
                  className="w-full accent-[#c9a84c]"
                />
                <div className="text-xs text-[#999] mt-1">Suggested: {role.suggested}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* SALE SIMULATOR */}
        <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6 mb-6">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">Sale Simulator</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Grams Sold</label>
              <input
                type="number"
                value={saleGrams}
                onChange={e => setSaleGrams(Number(e.target.value))}
                className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Sale Price ($)</label>
              <input
                type="number"
                value={salePrice}
                onChange={e => setSalePrice(Number(e.target.value))}
                className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#999] block mb-2">Deliveries</label>
              <input
                type="number"
                value={numDeliveries}
                onChange={e => setNumDeliveries(Number(e.target.value))}
                className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#c9a84c]"
              />
            </div>
          </div>

          <div className="bg-[#f5f0e8] rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between"><span className="text-[#999]">Gross Revenue</span><span className="font-bold">${grossRevenue.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#999]">Inventory Cost</span><span className="font-bold text-red-500">−${inventoryCost.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#999]">Delivery Cost</span><span className="font-bold text-red-500">−${totalDeliveryCost.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#999]">Profit Margin</span><span className="font-bold text-green-600">{profitMargin}%</span></div>
            </div>
            <div className="border-t border-[#e0d9cc] mt-3 pt-3 flex justify-between font-bold">
              <span>Net Profit</span>
              <span className="text-[#c9a84c] text-lg">${netProfit.toFixed(2)}</span>
            </div>
          </div>

          <h3 className="font-bold text-sm mb-3">Individual Payouts</h3>
          <div className="flex flex-col gap-2">
            {ROLES.map(role => (
              <div key={role.key} className="flex items-center justify-between py-2 border-b border-[#e0d9cc] last:border-0">
                <div>
                  <span className="font-bold text-sm">{role.label}</span>
                  <span className="text-[#999] text-xs ml-2">{splits[role.key]}%</span>
                </div>
                <span className={`font-bold ${payouts[role.key] >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ${payouts[role.key].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FULL QP PROJECTION */}
        <div className="bg-[#1a1a1a] text-[#f5f0e8] rounded-2xl p-6">
          <h2 style={{fontFamily: 'Georgia, serif'}} className="text-lg font-bold mb-4">Full QP Projection</h2>
          <p className="text-[#999] text-xs mb-4">If you sell the entire QP at current sale price of ${salePrice} for {saleGrams}g</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[#999] text-xs mb-1">Units to sell</div>
              <div className="text-2xl font-bold text-[#c9a84c]">{Math.floor(112 / saleGrams)}</div>
            </div>
            <div>
              <div className="text-[#999] text-xs mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-[#c9a84c]">${(Math.floor(112 / saleGrams) * salePrice).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[#999] text-xs mb-1">Total Profit</div>
              <div className="text-2xl font-bold text-[#f5f0e8]">${(Math.floor(112 / saleGrams) * netProfit).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[#999] text-xs mb-1">ROI on $400 QP</div>
              <div className="text-2xl font-bold text-[#f5f0e8]">{(((Math.floor(112 / saleGrams) * netProfit) / costPerQP) * 100).toFixed(0)}%</div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <div className="text-xs text-[#999] mb-3">Team payouts from full QP sale:</div>
            {ROLES.map(role => (
              <div key={role.key} className="flex justify-between text-sm py-1">
                <span className="text-[#f5f0e8]/70">{role.label}</span>
                <span className="font-bold text-[#c9a84c]">${(Math.floor(112 / saleGrams) * payouts[role.key]).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}