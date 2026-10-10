import { cx } from '@/components/ui'

/** A titled block of the page. Hairline-ruled, not a card. */
export function Section({ title, action, children, className = '' }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <section className={cx('border-t border-line pt-6', className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="display text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** One label/value line in a definition list. */
export function Row({ label, detail, value, tone, strong }: {
  label: React.ReactNode; detail?: React.ReactNode; value: React.ReactNode
  tone?: 'ok' | 'danger' | 'warn' | 'gold'; strong?: boolean
}) {
  const toneClass = tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : tone === 'gold' ? 'text-gold-ink' : 'text-ink'
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <dt className="min-w-0">
        <span className={cx('text-sm', strong ? 'font-semibold text-ink' : 'text-muted')}>{label}</span>
        {detail && <span className="mt-0.5 block text-xs text-muted">{detail}</span>}
      </dt>
      <dd className={cx('tabular shrink-0 text-right text-sm', strong ? 'font-semibold' : 'font-medium', toneClass)}>{value}</dd>
    </div>
  )
}

export function Rows({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <dl className={cx('flex flex-col', className)}>{children}</dl>
}

/** A headline figure with its label beneath. Used in a plain row, never as a card grid. */
export function Figure({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'gold' | 'ok' }) {
  return (
    <div className="min-w-0">
      <div className={cx('display tabular text-3xl font-semibold leading-tight', tone === 'gold' && 'text-gold-ink', tone === 'ok' && 'text-ok')}>{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
      <span className="text-muted">{icon}</span>
      <p className="display text-xl font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

/** A thin progress rule. */
export function Meter({ value, tone = 'gold', label }: { value: number; tone?: 'gold' | 'warn'; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="h-1.5 overflow-hidden rounded-full bg-sunken">
      <div className={cx('h-full rounded-full transition-[width] duration-500', tone === 'warn' ? 'bg-warn' : 'bg-gold')} style={{ width: `${pct}%` }} />
    </div>
  )
}
