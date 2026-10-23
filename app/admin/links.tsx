'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase/browser'
import { Button } from '@/components/ui'
import { CopyButton } from './accounts'

/** The storefront QR code, sized to show from a phone, with a large image for printing. */

export function LinksTab() {
  const [origin, setOrigin] = useState('')
  const [qrOrders, setQrOrders] = useState<number | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the page origin after mount
    setOrigin(window.location.origin)
    supabase().from('orders').select('id', { count: 'exact', head: true }).eq('source', 'qr').neq('status', 'cancelled')
      .then(({ count, error }) => setQrOrders(error ? null : count ?? 0))
  }, [])

  if (!origin) return null

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="display text-2xl font-semibold">Lucky Dayze QR</h2>
        <p className="mt-1 text-sm text-muted">
          Opens the homepage. Orders from it are tagged as coming from the QR code.
          {qrOrders !== null && <> So far: <span className="tabular font-semibold text-ink">{qrOrders}</span> order{qrOrders === 1 ? '' : 's'}.</>}
        </p>
      </div>
      <QrCard url={`${origin}/?src=qr`} name="lucky-dayze-qr" />
    </section>
  )
}

function QrCard({ url, name }: { url: string; name: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [url])

  async function download() {
    const png = await QRCode.toDataURL(url, { margin: 2, width: 1200, color: { dark: '#111111', light: '#ffffff' } })
    const a = document.createElement('a')
    a.href = png
    a.download = `${name}.png`
    a.click()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Always dark on white, whatever the theme, so every phone camera can read it. */}
      <div
        role="img"
        aria-label={`QR code for ${url}`}
        className="w-full max-w-72 overflow-hidden rounded-2xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="max-w-full break-all text-center text-sm text-muted">{url}</p>
      <div className="flex gap-2">
        <CopyButton text={url} />
        <Button size="sm" variant="outline" onClick={download}>Save image</Button>
      </div>
    </div>
  )
}
