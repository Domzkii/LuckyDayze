'use client'

import { useState } from 'react'

export default function SecretPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)

  function check() {
    if (password === 'luckydayze2025') {
      setAuthenticated(true)
      setWrong(false)
    } else {
      setWrong(true)
    }
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-xs">
          <div className="text-center mb-10">
            <div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-1">LUCKY DAYZE</div>
            <div className="text-xs tracking-widest uppercase text-[#999]">Staff Access</div>
          </div>
          <div className="bg-white border border-[#e0d9cc] rounded-2xl p-6">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') check() }}
              className="w-full bg-[#f5f0e8] border border-[#e0d9cc] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#c9a84c] placeholder-[#bbb]"
            />
            {wrong && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <button
              onClick={check}
              className="w-full bg-[#1a1a1a] text-[#f5f0e8] font-bold py-3 rounded-xl hover:bg-[#333] transition-all"
            >
              Enter
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a1a1a] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div style={{fontFamily: 'Georgia, serif'}} className="text-3xl font-bold mb-1">LUCKY DAYZE</div>
          <div className="text-xs tracking-widest uppercase text-[#999]">Staff Portal</div>
        </div>
        <div className="flex flex-col gap-4">
          <a href="/admin" className="bg-[#1a1a1a] text-[#f5f0e8] font-bold py-4 rounded-2xl text-center text-lg hover:bg-[#333] transition-all">
            Admin Dashboard
          </a>
          <a href="/finance" className="bg-[#c9a84c] text-[#1a1a1a] font-bold py-4 rounded-2xl text-center text-lg hover:bg-[#e8c97a] transition-all">
            Finance Dashboard
          </a>
          <a href="/" className="border border-[#1a1a1a]/20 text-[#666] font-bold py-4 rounded-2xl text-center hover:border-[#1a1a1a] transition-all">
            Back to Store
          </a>
        </div>
      </div>
    </main>
  )
}