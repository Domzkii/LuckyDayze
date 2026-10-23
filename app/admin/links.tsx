'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase/browser'
import type { SecretLink } from '@/lib/types'
import { Button, ConfirmDialog, Notice, Spinner } from '@/components/ui'
import { CopyButton } from './accounts'
import { Switch, errorText } from './shared'

/** QR codes to show from a phone: the main storefront, and Hussein's dad's secret page. */

function newCode() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), b => alphabet[b % alphabet.length]).join('')
}

export function LinksTab() {
  const [origin, setOrigin] = useState('')
  const [link, setLink] = useState<SecretLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [qrOrders, setQrOrders] = useState<number | null>(null)

  const load = useCallback(async () => {
    const db = supabase()
    const [{ data, error }, qr] = await Promise.all([
      db.from('secret_links').select('*').eq('seller', 'hussein_dad').maybeSingle(),
      db.from('orders').select('id', { count: 'exact', head: true }).eq('source', 'qr').neq('status', 'cancelled'),
    ])
    setQrOrders(qr.error ? null : qr.count ?? 0)
    setLoading(false)
    if (error) return setError(errorText(error))
    setLink(data as SecretLink | null)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the page origin and data after mount
    setOrigin(window.location.origin)
    load()
  }, [load])

  async function update(patch: Partial<SecretLink>) {
    setBusy(true)
    setError(null)
    const { error } = await supabase().from('secret_links').update({ ...patch, updated_at: new Date().toISOString() }).eq('seller', 'hussein_dad')
    if (error) setError(errorText(error))
    await load()
    setBusy(false)
  }

  if (!origin) return null
  const secretUrl = link ? `${origin}/s/${link.code}` : ''

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="display text-2xl font-semibold">Lucky Dayze QR</h2>
          <p className="mt-1 text-sm text-muted">Opens the homepage. Orders from it are tagged as coming from the QR code.
            {qrOrders !== null && <> So far: <span className="tabular font-semibold text-ink">{qrOrders}</span> order{qrOrders === 1 ? '' : 's'}.</>}
          </p>
        </div>
        <QrCard url={`${origin}/?src=qr`} name="lucky-dayze-qr" />
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="display text-2xl font-semibold">Hussein’s dad’s page</h2>
            <p className="mt-1 text-sm text-muted">
              Secret menu: 8ths only, {link ? `$${Number(link.price_eighth)}` : '$20'}, no account. Orders show up in Orders tagged with his name.
            </p>
          </div>
          {link && <Switch checked={link.enabled} onChange={on => update({ enabled: on })} label="Page on" busy={busy} />}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        {loading ? (
          <Spinner label="Loading" />
        ) : !link ? (
          <Notice>Run migration 0012 in Supabase to turn this on.</Notice>
        ) : !link.enabled ? (
          <Notice tone="warn">The page is off. Anyone opening the link sees “This page isn’t available.”</Notice>
        ) : (
          <QrCard url={secretUrl} name="hussein-dad-qr" />
        )}
        {link && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setConfirmNew(true)}>
            Make a new link
          </Button>
        )}
      </section>

      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        onConfirm={async () => { await update({ code: newCode() }); setConfirmNew(false) }}
        loading={busy}
        tone="danger"
        title="Make a new link?"
        confirmLabel="Make new link"
        body="The old link and QR code stop working right away. Use this if the link got passed around too much."
      />
    </div>
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
