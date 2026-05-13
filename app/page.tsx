import { supabase } from './supabase'

async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
  console.log('products:', data)
  console.log('error:', error)
  return data || []
}

export default async function Home() {
  const products = await getProducts()
  const flower = products.filter(p => p.category === 'Flower')
  const allProducts = products

  return (
    <main className="min-h-screen bg-[#0a0c0b] text-[#f0ede6]">

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="text-[#c9a84c] text-2xl font-bold tracking-tight">
          LuckyDayze
        </div>
        <div className="text-sm text-white/50 hidden sm:block">NYC Cannabis Delivery</div>
        <button className="bg-[#c9a84c] text-black text-sm font-bold px-5 py-2 rounded-full">
          Order Now
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
          <button className="bg-[#c9a84c] text-black font-bold px-8 py-3 rounded-full">
            Shop Now
          </button>
          <button className="border border-white/20 text-white px-8 py-3 rounded-full">
            View Rewards
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

      {/* ALL PRODUCTS FROM SUPABASE */}
      <section className="px-6 pb-16">
        <h2 className="text-xl font-bold mb-6">Best Sellers 🔥</h2>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          {allProducts.map((product) => (
            <div
              key={product.id}
              className="bg-[#1c201e] border border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:border-[#c9a84c]/50 transition-all"
            >
              <div className="h-28 bg-[#1a3d2b] flex items-center justify-center text-5xl">
                {product.emoji}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
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
                  <button className="bg-[#c9a84c] text-black font-bold w-8 h-8 rounded-full text-lg">
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </main>
  )
}