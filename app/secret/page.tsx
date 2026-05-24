'use client'

import { useState } from 'react'
import { useTheme } from '../theme'

export default function SecretPage() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const bg = dark ? 'bg-[#0f0f0f]' : 'bg-[#f5f0e8]'
  const bg2 = dark ? 'bg-[#1a1a1a]' : 'bg-white'
  const text = dark ? 'text-[#f5f0e8]' : 'text-[#1a1a1a]'
  const text2 = dark ? 'text-[#aaa]' : 'text-[#666]'
  const text3 = dark ? 'text-[#666]' : 'text-[#999]'
  const border = dark ? 'border-[#333]' : 'border-[#e0d9cc]'
  const input = dark ? 'bg-[#222] border-[#444] text-[#f5f0e8] placeholder-[#555]' : 'bg-[#f5f0e8] border-[#e0d9cc] text-[#1a1a1a] placeholder-[#bbb]'

  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)

  function check() {
    if (password === 'luckydayze2025') { setAuthenticated(true); setWrong(false) }
    else setWrong(true)
  }

  if (!authenticated) {
    return (
      <main className={`min-h-screen ${bg} ${text} flex flex-col items-center justify-center px-6 transition-colors`}>
        <div className="w-full max-w-xs">
          <div className="text-center mb-10">
            <div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-1">LUCKY DAYZE</div>
            <div className={`text-xs tracking-widest uppercase ${text3}`}>Staff Access</div>
          </div>
          <div className={`${bg2} border ${border} rounded-2xl p-6`}>
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') check() }}
              className={`w-full border rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] ${input}`} />
            {wrong && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <button onClick={check} className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all mb-3">Enter</button>
            <a href="/" className={`w-full border ${border} ${text2} font-bold py-3 rounded-xl hover:border-[#c9a84c] transition-all text-center text-sm block`}>Back to Store</a>
          </div>
          <div className="flex justify-center mt-6">
            <button onClick={toggle} className="text-lg">{dark ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={`min-h-screen ${bg} ${text} flex flex-col items-center justify-center px-6 transition-colors`}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-1">LUCKY DAYZE</div>
          <div className={`text-xs tracking-widest uppercase ${text3}`}>Staff Portal</div>
        </div>
        <div className="flex flex-col gap-4">
          <a href="/admin" className="bg-[#1a1a1a] text-[#f5f0e8] font-bold py-4 rounded-2xl text-center text-lg hover:bg-[#333] transition-all">Admin Dashboard</a>
          <a href="/finance" className="bg-[#c9a84c] text-[#1a1a1a] font-bold py-4 rounded-2xl text-center text-lg hover:bg-[#e8c97a] transition-all">Finance Dashboard</a>
          <a href="/" className={`border ${border} ${text2} font-bold py-4 rounded-2xl text-center hover:border-[#c9a84c] transition-all`}>Back to Store</a>
        </div>
        <div className="flex justify-center mt-6">
          <button onClick={toggle} className="text-lg">{dark ? '☀️' : '🌙'}</button>
        </div>
      </div>
    </main>
  )
}