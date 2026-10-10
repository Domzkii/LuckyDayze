'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase/browser'
import { Badge, Button, ConfirmDialog, Dialog, Field, Notice, Segmented, Spinner, cx, inputClass } from '@/components/ui'
import { money } from '@/lib/format'
import type { SaleEvent } from '@/lib/types'
import { EmptyState, errorText } from './shared'

const APPLIES_LABEL: Record<SaleEvent['applies_to'], string> = { all: 'Whole order', flower: 'Flower only', prerolls: 'Pre-rolls only' }

function describe(sale: Pick<SaleEvent, 'discount_type' | 'discount_value' | 'applies_to'>) {
  const amount = sale.discount_type === 'percent' ? `${Number(sale.discount_value)}% off` : `${money(Number(sale.discount_value))} off`
  return `${amount} · ${APPLIES_LABEL[sale.applies_to]}`
}

export function PromosTab() {
  const [sales, setSales] = useState<SaleEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SaleEvent | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase().from('sales_events').select('*').order('created_at', { ascending: false })
    if (error) setError(errorText(error))
    setSales((data ?? []) as SaleEvent[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load()
  }, [load])

  async function setActive(sale: SaleEvent, active: boolean) {
    setBusyId(sale.id)
    setError(null)
    const client = supabase()
    if (active) {
      const { error } = await client.from('sales_events').update({ is_active: false }).neq('id', sale.id).eq('is_active', true)
      if (error) { setBusyId(null); return setError(errorText(error)) }
    }
    const { error } = await client.from('sales_events').update({ is_active: active }).eq('id', sale.id)
    setBusyId(null)
    if (error) return setError(errorText(error))
    load()
  }

  async function remove() {
    if (!deleting) return
    setBusyId(deleting.id)
    const { error } = await supabase().from('sales_events').delete().eq('id', deleting.id)
    setBusyId(null)
    setDeleting(null)
    if (error) return setError(errorText(error))
    load()
  }

  return (
    <section aria-label="Promotions" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">One promo can run at a time. It shows on the storefront and applies at checkout.</p>
        <Button size="sm" variant="gold" onClick={() => setCreating(true)} className="shrink-0">
          <Plus size={16} strokeWidth={2} aria-hidden /> New promo
        </Button>
      </div>

      {error && <Notice tone="danger" title="That didn’t work">{error}</Notice>}

      {sales === null ? (
        <Spinner label="Loading promos" />
      ) : sales.length === 0 ? (
        <EmptyState icon={<Tag size={28} strokeWidth={1.5} />} title="No promos yet">
          Create a percent or dollar discount for the whole order, flower or pre-rolls.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {sales.map(sale => (
            <li key={sale.id} className={cx('flex flex-col gap-3 rounded-2xl border bg-surface p-4', sale.is_active ? 'border-gold' : 'border-line')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="display truncate text-lg font-semibold">{sale.title}</p>
                  <p className="text-sm text-muted">{describe(sale)}</p>
                </div>
                {sale.is_active ? <Badge tone="gold">Live</Badge> : <Badge>Off</Badge>}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant={sale.is_active ? 'outline' : 'primary'}
                  loading={busyId === sale.id}
                  onClick={() => setActive(sale, !sale.is_active)}
                >
                  {sale.is_active ? 'Turn off' : 'Go live'}
                </Button>
                <Button variant="danger" onClick={() => setDeleting(sale)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewPromoDialog open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this promo?"
        body={deleting ? `“${deleting.title}” will be removed${deleting.is_active ? ' and stop applying at checkout' : ''}.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={!!deleting && busyId === deleting.id}
      />
    </section>
  )
}

function NewPromoDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<SaleEvent['discount_type']>('percent')
  const [value, setValue] = useState('')
  const [appliesTo, setAppliesTo] = useState<SaleEvent['applies_to']>('all')
  const [errors, setErrors] = useState<{ title?: string; value?: string; form?: string }>({})
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitle(''); setType('percent'); setValue(''); setAppliesTo('all'); setErrors({})
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(value)
    const next: typeof errors = {}
    if (!title.trim()) next.title = 'Give the promo a name customers will see.'
    if (!(n > 0)) next.value = 'Enter an amount above 0.'
    else if (type === 'percent' && n > 100) next.value = 'A percent discount can’t be more than 100.'
    setErrors(next)
    if (next.title || next.value) return

    setSaving(true)
    const { error } = await supabase().from('sales_events').insert({
      title: title.trim(), discount_type: type, discount_value: n, applies_to: appliesTo, is_active: false,
    })
    setSaving(false)
    if (error) return setErrors({ form: errorText(error) })
    reset()
    onCreated()
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose() }} title="New promo">
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Name" hint="Shown on the storefront, e.g. “Friday 420 drop”." error={errors.title}>
          {props => <input {...props} value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />}
        </Field>
        <Segmented
          label="Discount type"
          value={type}
          onChange={setType}
          options={[{ value: 'percent', label: 'Percent off' }, { value: 'dollar', label: 'Dollars off' }]}
        />
        <Field label={type === 'percent' ? 'Percent off' : 'Dollars off'} error={errors.value}>
          {props => (
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{type === 'percent' ? '%' : '$'}</span>
              <input {...props} type="number" inputMode="decimal" min="0" value={value} onChange={e => setValue(e.target.value)} className={cx(inputClass, 'tabular pl-9')} />
            </div>
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Applies to</span>
          <Segmented
            label="Applies to"
            value={appliesTo}
            onChange={setAppliesTo}
            size="sm"
            options={[{ value: 'all', label: 'Whole order' }, { value: 'flower', label: 'Flower' }, { value: 'prerolls', label: 'Pre-rolls' }]}
          />
        </div>
        {errors.form && <Notice tone="danger" title="Couldn’t create the promo">{errors.form}</Notice>}
        <Button type="submit" size="lg" loading={saving}>Create promo</Button>
        <p className="-mt-2 text-center text-sm text-muted">It starts switched off. Go live when you’re ready.</p>
      </form>
    </Dialog>
  )
}
