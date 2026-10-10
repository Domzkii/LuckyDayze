'use client'

import { forwardRef, useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { Loader2, X } from 'lucide-react'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 select-none'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-canvas hover:bg-ink/85',
  gold: 'bg-gold text-on-gold hover:brightness-105',
  outline: 'border border-line-strong text-ink hover:border-ink',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:bg-danger-tint',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-5 text-[15px]',
  lg: 'min-h-14 px-7 text-base',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], extra)
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export function ButtonLink({
  href, variant = 'primary', size = 'md', className = '', children, external,
}: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: React.ReactNode; external?: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  )
}

export function IconButton({
  label, className = '', children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

// ─── Form fields ─────────────────────────────────────────────────────────────

export const inputClass =
  'w-full min-h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-muted/80 transition-colors hover:border-line-strong focus:border-gold-ink focus:outline-none aria-[invalid=true]:border-danger'

interface FieldProps {
  label: string
  hint?: string
  error?: string | null
  optional?: boolean
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => React.ReactNode
  className?: string
}

export function Field({ label, hint, error, optional, children, className = '' }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">optional</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

// ─── Choice controls ─────────────────────────────────────────────────────────

interface SegmentedProps<T extends string> {
  label: string
  value: T | null
  options: { value: T; label: React.ReactNode; disabled?: boolean }[]
  onChange: (value: T) => void
  className?: string
  size?: 'md' | 'sm'
}

/** A row of mutually exclusive choices, built on real radio inputs for keyboard and screen readers. */
export function Segmented<T extends string>({ label, value, options, onChange, className = '', size = 'md' }: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset className={className}>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label
            key={opt.value}
            className={cx(
              'relative inline-flex flex-1 cursor-pointer items-center justify-center rounded-full border text-center font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-ink',
              size === 'md' ? 'min-h-11 px-4 text-sm' : 'min-h-10 px-3 text-[13px]',
              value === opt.value ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-ink hover:border-line-strong',
              opt.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={opt.disabled}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface ChoiceCardProps {
  name: string
  checked: boolean
  onChange: () => void
  title: React.ReactNode
  detail?: React.ReactNode
  aside?: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

/** A large radio option: a title, a line of detail, and an optional note on the right. */
export function ChoiceCard({ name, checked, onChange, title, detail, aside, icon, disabled }: ChoiceCardProps) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-ink',
        checked ? 'border-ink bg-surface shadow-lift' : 'border-line bg-surface/60 hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      <span
        aria-hidden
        className={cx(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          checked ? 'border-ink' : 'border-line-strong',
        )}
      >
        {checked && <span className="size-2.5 rounded-full bg-ink" />}
      </span>
      {icon && <span className="mt-0.5 shrink-0 text-muted">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-ink">{title}</span>
        {detail && <span className="text-sm text-muted">{detail}</span>}
      </span>
      {aside && <span className="shrink-0 text-sm font-semibold">{aside}</span>}
    </label>
  )
}

// ─── Status ──────────────────────────────────────────────────────────────────

type Tone = 'neutral' | 'gold' | 'ok' | 'warn' | 'danger' | 'indica' | 'night'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  gold: 'bg-gold text-on-gold',
  ok: 'bg-ok-tint text-ok',
  warn: 'bg-warn-tint text-warn',
  danger: 'bg-danger-tint text-danger',
  indica: 'bg-indica-tint text-indica',
  night: 'bg-night text-gold',
}

export function Badge({ tone = 'neutral', className = '', children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none', toneClasses[tone], className)}>
      {children}
    </span>
  )
}

export function Notice({ tone = 'neutral', icon, title, children, className = '' }: {
  tone?: Tone; icon?: React.ReactNode; title?: React.ReactNode; children?: React.ReactNode; className?: string
}) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={cx('flex gap-3 rounded-2xl px-4 py-3.5 text-sm', toneClasses[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 size={18} className="animate-spin" aria-hidden />
      {label}
    </div>
  )
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Visually hide the title (it is still announced). */
  hideTitle?: boolean
  /** 'center': card on desktop, bottom sheet on phones. 'drawer': full-height panel from the right. */
  variant?: 'center' | 'drawer'
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/**
 * Native <dialog> as a modal: focus is trapped, Escape closes, the page behind is inert.
 */
export function Dialog({ open, onClose, title, hideTitle, variant = 'center', children, footer, className = '' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const drawer = variant === 'drawer'

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={e => { e.preventDefault(); onClose() }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className={cx(
        'm-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:animate-fade open:flex',
        drawer
          ? 'ml-auto h-dvh w-full sm:max-w-md'
          : 'mt-auto w-full sm:m-auto sm:max-w-lg',
      )}
    >
      {open && (
        <div
          className={cx(
            'flex w-full flex-col bg-canvas',
            drawer
              ? 'h-full animate-sheet-left border-l border-line'
              : 'max-h-[92dvh] animate-sheet-up rounded-t-3xl shadow-sheet sm:max-h-[85dvh] sm:animate-rise sm:rounded-3xl',
            className,
          )}
        >
          <div className="flex items-center justify-between gap-4 px-6 pb-3 pt-5">
            <h2 id={titleId} className={cx('display text-2xl font-semibold', hideTitle && 'sr-only')}>{title}</h2>
            <IconButton label="Close" onClick={onClose} className="-mr-2 ml-auto">
              <X size={20} strokeWidth={1.75} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">{children}</div>
          {footer && <div className="border-t border-line px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

/** In-page confirmation, instead of window.confirm(). */
export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel, tone = 'primary', loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: React.ReactNode
  confirmLabel: string; tone?: 'primary' | 'danger'; loading?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Keep it</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className={cx('flex-1', tone === 'danger' && 'bg-danger text-canvas hover:bg-danger/90 border-transparent')}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-muted">{body}</div>
    </Dialog>
  )
}

// ─── Brand ───────────────────────────────────────────────────────────────────

export function Wordmark({ sub = 'New York Cannabis House', size = 'md' }: { sub?: string | null; size?: 'md' | 'lg' }) {
  return (
    <span className="flex flex-col leading-none">
      <span className={cx('display whitespace-nowrap font-semibold uppercase tracking-[0.14em]', size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-lg sm:text-xl')}>
        Lucky Dayze
      </span>
      {sub && <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{sub}</span>}
    </span>
  )
}
