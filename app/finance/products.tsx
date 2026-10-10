'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ImagePlus, Leaf, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { WEIGHTS, WEIGHT_LABELS, money } from '@/lib/format'
import { PREROLL_DEAL, startingPrice } from '@/lib/pricing'
import type { Category, Product, StrainType } from '@/lib/types'
import { Badge, Button, Dialog, Field, Notice, Segmented, cx, inputClass } from '@/components/ui'
import { formatWeight } from './math'

const STRAIN_TYPES: StrainType[] = ['Hybrid', 'Sativa', 'Indica']

export function Products({ products, onChanged }: { products: Product[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const active = products.filter(p => !p.archived)
  const archived = products.filter(p => p.archived)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-3xl font-semibold">Products</h2>
          <p className="mt-1 text-sm text-muted">What shows on the menu. Stock is set when you start a week.</p>
        </div>
        <Button onClick={() => setEditing('new')}><Plus size={16} strokeWidth={1.75} />Add product</Button>
      </div>

      {(['Flower', 'Pre-Rolls'] as Category[]).map(category => {
        const rows = active.filter(p => p.category === category)
        return (
          <section key={category} className="border-t border-line pt-5">
            <h3 className="mb-2 text-sm font-semibold">{category === 'Flower' ? 'Flower' : 'Pre-rolls'}</h3>
            {rows.length === 0 ? (
              <p className="py-3 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="flex flex-col">{rows.map(p => <ProductRow key={p.id} product={p} onEdit={() => setEditing(p)} />)}</ul>
            )}
          </section>
        )
      })}

      {archived.length > 0 && (
        <section className="border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            aria-expanded={showArchived}
            className="flex min-h-11 w-full items-center justify-between text-sm font-semibold"
          >
            Archived ({archived.length})
            <ChevronDown size={18} strokeWidth={1.75} className={cx('text-muted transition-transform', showArchived && 'rotate-180')} />
          </button>
          {showArchived && <ul className="flex flex-col">{archived.map(p => <ProductRow key={p.id} product={p} onEdit={() => setEditing(p)} />)}</ul>}
        </section>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add product' : 'Edit product'}>
        {editing !== null && (
          <ProductForm
            key={editing === 'new' ? 'new' : editing.id}
            product={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => { await onChanged(); setEditing(null) }}
          />
        )}
      </Dialog>
    </div>
  )
}

function ProductRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const photo = product.image_urls?.[0]
  return (
    <li className="border-b border-line last:border-b-0">
      <button type="button" onClick={onEdit} className="flex min-h-16 w-full items-center gap-3 py-3 text-left transition-colors hover:bg-sunken/60">
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sunken text-muted">
          {photo ? <Image src={photo} alt="" fill sizes="48px" unoptimized className="object-cover" /> : <Leaf size={20} strokeWidth={1.75} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{product.name}</span>
            {product.is_popular && <Badge tone="gold">Popular</Badge>}
          </span>
          <span className="tabular block text-xs text-muted">
            {product.strain_type}
            {product.thc ? ` · THC ${product.thc}` : ''}
            {product.category === 'Flower' ? ` · ${formatWeight(Number(product.stock_grams) || 0)}` : ''}
          </span>
        </span>
        <span className="tabular shrink-0 text-sm font-semibold">
          {product.category === 'Flower' ? 'from ' : ''}{money(startingPrice(product))}
        </span>
      </button>
    </li>
  )
}

interface FormState {
  name: string
  category: Category
  strain_type: StrainType
  thc: string
  description: string
  weight_prices: Record<string, string>
  price: string
  image_urls: string[]
  archived: boolean
}

function toForm(p: Product | null): FormState {
  return {
    name: p?.name ?? '',
    category: p?.category ?? 'Flower',
    strain_type: p?.strain_type ?? 'Hybrid',
    thc: p?.thc ?? '',
    description: p?.description ?? '',
    weight_prices: Object.fromEntries(WEIGHTS.map(w => [w, p?.weight_prices?.[w] ? String(p.weight_prices[w]) : ''])),
    price: p && p.category === 'Pre-Rolls' ? String(p.price) : '',
    image_urls: p?.image_urls ?? [],
    archived: p?.archived ?? false,
  }
}

function ProductForm({ product, onCancel, onSaved }: { product: Product | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<FormState>(() => toForm(product))
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }))

  const isFlower = form.category === 'Flower'
  const weightPrices = Object.fromEntries(
    WEIGHTS.map(w => [w, Number(form.weight_prices[w])]).filter(([, v]) => Number(v) > 0),
  ) as Record<string, number>
  const unitPrice = Number(form.price)
  const nameError = submitted && !form.name.trim() ? 'Give the product a name.' : null
  const priceError = submitted && (isFlower ? Object.keys(weightPrices).length === 0 : !(unitPrice > 0))
    ? isFlower ? 'Set a price for at least one weight.' : 'Set a price above $0.'
    : null

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase().storage.from('products').upload(path, file, { contentType: file.type })
      if (error) { setError(`Couldn’t upload ${file.name}: ${error.message}`); continue }
      urls.push(supabase().storage.from('products').getPublicUrl(path).data.publicUrl)
    }
    setForm(f => ({ ...f, image_urls: [...f.image_urls, ...urls] }))
    setUploading(false)
  }

  async function save() {
    setSubmitted(true)
    const name = form.name.trim()
    if (!name || (isFlower ? Object.keys(weightPrices).length === 0 : !(unitPrice > 0))) return
    setBusy(true)
    setError(null)
    const row = {
      name,
      category: form.category,
      strain_type: form.strain_type,
      thc: form.thc.trim() || null,
      description: form.description.trim() || null,
      weight_prices: isFlower ? weightPrices : {},
      price: isFlower ? weightPrices['3.5'] ?? Math.min(...Object.values(weightPrices)) : unitPrice,
      image_urls: form.image_urls,
      archived: form.archived,
    }
    const db = supabase()
    const { error } = product
      ? await db.from('products').update(row).eq('id', product.id)
      : await db.from('products').insert({ ...row, in_stock: !isFlower, stock_grams: 0 })
    setBusy(false)
    if (error) return setError(`Couldn’t save: ${error.message}`)
    await onSaved()
  }

  return (
    <div className="flex flex-col gap-5">
      {!product && (
        <Segmented
          label="Category"
          value={form.category}
          options={[{ value: 'Flower', label: 'Flower' }, { value: 'Pre-Rolls', label: 'Pre-roll' }]}
          onChange={v => set('category', v)}
        />
      )}

      <Field label="Name" error={nameError}>
        {props => <input {...props} value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} />}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Strain type</span>
        <Segmented label="Strain type" value={form.strain_type} options={STRAIN_TYPES.map(t => ({ value: t, label: t }))} onChange={v => set('strain_type', v)} />
      </div>

      <Field label="THC" optional hint="As it should read on the menu, e.g. 24%">
        {props => <input {...props} value={form.thc} onChange={e => set('thc', e.target.value)} className={inputClass} />}
      </Field>

      <Field label="Description" optional>
        {props => <textarea {...props} rows={3} value={form.description} onChange={e => set('description', e.target.value)} className={`${inputClass} py-3`} />}
      </Field>

      {isFlower ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Prices</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {WEIGHTS.map(w => (
              <label key={w} className="flex flex-col gap-1">
                <span className="text-xs text-muted">{WEIGHT_LABELS[w]}</span>
                <span className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={form.weight_prices[w]}
                    onChange={e => set('weight_prices', { ...form.weight_prices, [w]: e.target.value })}
                    aria-invalid={priceError ? true : undefined}
                    className={`${inputClass} tabular pl-7`}
                  />
                </span>
              </label>
            ))}
          </div>
          {priceError ? <p className="text-sm text-danger">{priceError}</p> : <p className="text-sm text-muted">Leave a weight empty to hide it.</p>}
        </fieldset>
      ) : (
        <Field
          label="Price each"
          error={priceError}
          hint={`Single price. Any two pre-rolls ring up at ${PREROLL_DEAL.short}.`}
        >
          {props => (
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input {...props} type="number" inputMode="decimal" min={0} value={form.price} onChange={e => set('price', e.target.value)} className={`${inputClass} tabular pl-8`} />
            </div>
          )}
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Photos</span>
        <div className="flex flex-wrap gap-3">
          {form.image_urls.map((url, i) => (
            <div key={url} className="relative size-20 overflow-hidden rounded-xl bg-sunken">
              <Image src={url} alt={`Photo ${i + 1}`} fill sizes="80px" unoptimized className="object-cover" />
              <button
                type="button"
                onClick={() => set('image_urls', form.image_urls.filter(u => u !== url))}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-0 top-0 flex size-11 items-start justify-end p-1.5"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-night text-on-night"><X size={14} strokeWidth={2} /></span>
              </button>
            </div>
          ))}
          <label className={cx(
            'flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-xs font-semibold text-muted transition-colors hover:border-ink hover:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-ink',
            uploading && 'pointer-events-none opacity-50',
          )}>
            <ImagePlus size={20} strokeWidth={1.75} />
            {uploading ? 'Uploading' : 'Add'}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={e => { upload(e.target.files); e.target.value = '' }} />
          </label>
        </div>
        <p className="text-sm text-muted">The first photo leads on the menu.</p>
      </div>

      {product && (
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-t border-line pt-4">
          <span>
            <span className="block text-sm font-semibold">Archived</span>
            <span className="block text-sm text-muted">Hidden from the menu and from week setup. History stays.</span>
          </span>
          <input type="checkbox" checked={form.archived} onChange={e => set('archived', e.target.checked)} className="size-5 shrink-0 accent-gold" />
        </label>
      )}

      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" onClick={save} loading={busy} disabled={uploading}>{product ? 'Save changes' : 'Add product'}</Button>
      </div>
    </div>
  )
}
