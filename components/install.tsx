'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ChevronDown, Copy, EllipsisVertical, Menu, Share, SquarePlus, X } from 'lucide-react'
import { installPlatform, isInstalled, useInstallPrompt, type InstallPlatform } from '@/lib/install'
import { closeInstallBanner, countInstallBanner, installBannerAllowed } from '@/lib/local'
import { Button, Dialog, IconButton, Segmented, cx } from './ui'

/** A drawing of the button they're looking for, so the step matches what's on screen. */
function Key({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="mx-0.5 inline-flex h-7 min-w-7 translate-y-[-1px] items-center justify-center gap-1 rounded-lg border border-line bg-sunken px-1.5 align-middle text-[13px] font-semibold text-ink">
      {children}
      <span className="sr-only">{label}</span>
    </span>
  )
}

type Step = { title: React.ReactNode; detail?: React.ReactNode }

function stepsFor(platform: InstallPlatform): Step[] {
  switch (platform) {
    // iOS 27 Safari: Share lives behind the ≡ button in the address bar, and Add to Home Screen
    // is under View More in the share sheet. Safari no longer reports its real iOS version, so
    // older iPhones (Share right in the bottom bar) get a note instead of their own steps.
    case 'ios-safari':
      return [
        {
          title: <>Tap <Key label="the menu button"><Menu size={15} strokeWidth={2} /></Key> in the address bar</>,
          detail: <>It’s on the left side of the address bar at the bottom of the screen. On an older iPhone, skip this: the Share button <Key label="Share"><Share size={15} strokeWidth={2} /></Key> is right in the bottom bar.</>,
        },
        { title: <>Tap <Key label=""><Share size={15} strokeWidth={2} /> Share</Key></> },
        {
          title: <>Tap <Key label=""><ChevronDown size={15} strokeWidth={2} /> View More</Key></>,
          detail: 'Then scroll down the list.',
        },
        { title: <>Tap <Key label=""><SquarePlus size={15} strokeWidth={2} /> Add to Home Screen</Key></> },
        { title: <>Tap <Key label="">Add</Key></> },
      ]
    case 'ios-chrome':
      return [
        {
          title: <>Tap the Share button <Key label="Share"><Share size={15} strokeWidth={2} /></Key></>,
          detail: 'It’s at the top right, next to the address bar.',
        },
        {
          title: <>Tap <Key label=""><SquarePlus size={15} strokeWidth={2} /> Add to Home Screen</Key></>,
          detail: 'You may need to scroll down the list to find it.',
        },
        { title: <>Tap <Key label="">Add</Key> in the top right corner</> },
      ]
    case 'ios-other':
      return [
        { title: 'Open this page in Safari', detail: 'This browser can’t add it to your home screen. Copy the link below and paste it into Safari.' },
        ...stepsFor('ios-safari'),
      ]
    case 'android':
    case 'desktop':
      return [
        {
          title: <>Tap the menu <Key label="Menu"><EllipsisVertical size={15} strokeWidth={2} /></Key></>,
          detail: 'It’s at the top right of Chrome.',
        },
        {
          title: <>Tap <Key label="">Add to home screen</Key></>,
          detail: 'On some phones it says “Install app.”',
        },
        { title: <>Tap <Key label="">Install</Key></> },
      ]
  }
}

function CopyLink() {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      className="self-start"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.origin)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {}
      }}
    >
      {copied ? <><Check size={16} strokeWidth={2} /> Copied</> : <><Copy size={16} strokeWidth={1.75} /> Copy link</>}
    </Button>
  )
}

/** The steps for one kind of phone. Android shows a one-tap Install button when Chrome offers it. */
export function InstallSteps({ platform }: { platform: InstallPlatform }) {
  const { canPrompt, prompt } = useInstallPrompt()
  const [done, setDone] = useState(false)

  if (done) {
    return <p className="flex items-center gap-2 font-semibold text-ok"><Check size={18} strokeWidth={2} /> Installed. Find LuckyDayze on your home screen.</p>
  }

  if (platform === 'android' && canPrompt) {
    return (
      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={async () => setDone(await prompt())}>Install LuckyDayze</Button>
        <p className="text-sm text-muted">Then tap Install when your phone asks.</p>
      </div>
    )
  }

  const steps = stepsFor(platform)
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-on-gold" aria-hidden>{i + 1}</span>
            <div className="flex flex-col gap-1 pt-0.5">
              <p className="font-semibold leading-relaxed">{s.title}</p>
              {s.detail && <p className="text-sm leading-relaxed text-muted">{s.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      {platform === 'ios-other' && <CopyLink />}
      <p className="text-sm text-muted">LuckyDayze shows up on your home screen. Open it from there, like any app.</p>
    </div>
  )
}

/** The phone they're on, or a picker when we can't tell (desktop) or they want the other one. */
export function InstallGuide() {
  const [detected, setDetected] = useState<InstallPlatform | null>(null)
  const [choice, setChoice] = useState<'iphone' | 'android'>('iphone')
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const p = installPlatform()
    /* eslint-disable react-hooks/set-state-in-effect -- device checks after mount */
    setDetected(p)
    setChoice(p === 'android' ? 'android' : 'iphone')
    setInstalled(isInstalled())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  if (!detected) return null
  if (installed) {
    return <p className="flex items-center gap-2 font-semibold text-ok"><Check size={18} strokeWidth={2} /> You’ve already got it. You’re using the app right now.</p>
  }

  const onIphone = detected.startsWith('ios')
  const platform: InstallPlatform = choice === 'android' ? 'android' : onIphone ? detected : 'ios-safari'

  return (
    <div className="flex flex-col gap-6">
      {detected === 'desktop' && (
        <p className="text-muted">Open <span className="font-semibold text-ink">{window.location.host}/app</span> on your phone, or follow along here.</p>
      )}
      <Segmented
        label="Your phone"
        value={choice}
        onChange={setChoice}
        size="sm"
        className="max-w-xs"
        options={[{ value: 'iphone', label: 'iPhone' }, { value: 'android', label: 'Android' }]}
      />
      <InstallSteps platform={platform} />
    </div>
  )
}

/** "How do I add it?" as a sheet, for the banner and the order page. */
export function InstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [platform, setPlatform] = useState<InstallPlatform>('ios-safari')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device check after mount
    setPlatform(installPlatform())
  }, [])
  return (
    <Dialog open={open} onClose={onClose} title="Add to your home screen">
      <div className="flex flex-col gap-5">
        <InstallSteps platform={platform} />
        <Link href="/app" className="text-sm font-semibold text-gold-ink underline underline-offset-4 hover:text-ink">On a different phone?</Link>
      </div>
    </Dialog>
  )
}

const BANNER_DELAY_MS = 3000
const BANNER_SHOW_MS = 10_000

/**
 * A brief nudge on the menu, phones only. Slides up after a few seconds, slides away on its
 * own (but not while they're touching it), and shows at most twice per phone.
 */
export function InstallBanner({ raised }: { raised?: boolean }) {
  const { canPrompt, prompt } = useInstallPrompt()
  const [platform, setPlatform] = useState<InstallPlatform | null>(null)
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden')
  const [helpOpen, setHelpOpen] = useState(false)
  const holding = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleHide(ms = BANNER_SHOW_MS) {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => { if (!holding.current) setPhase(p => (p === 'in' ? 'out' : p)) }, ms)
  }

  useEffect(() => {
    const p = installPlatform()
    if (p === 'desktop' || isInstalled() || !installBannerAllowed()) return
    const t = setTimeout(() => {
      countInstallBanner()
      setPlatform(p)
      setPhase('in')
      scheduleHide()
    }, BANNER_DELAY_MS)
    return () => {
      clearTimeout(t)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  function close() {
    closeInstallBanner()
    setPhase('out')
  }

  async function act() {
    holding.current = true
    if (platform === 'android' && canPrompt) {
      if (await prompt()) closeInstallBanner()
      setPhase('out')
    } else {
      setHelpOpen(true)
    }
  }

  return (
    <>
      {phase !== 'hidden' && (
        <div
          role="region"
          aria-label="Add LuckyDayze to your home screen"
          onPointerEnter={() => { holding.current = true }}
          onPointerLeave={() => { holding.current = false; scheduleHide(4000) }}
          onFocus={() => { holding.current = true }}
          onBlur={() => { holding.current = false; scheduleHide(4000) }}
          onAnimationEnd={() => { if (phase === 'out') setPhase('hidden') }}
          className={cx(
            'fixed inset-x-3 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pl-4 pr-1.5 shadow-lift',
            raised ? 'bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)]' : 'bottom-[max(1rem,env(safe-area-inset-bottom))]',
            phase === 'out' ? 'animate-banner-out' : 'animate-banner-in',
          )}
        >
          <Image src="/logo-192.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-[10px]" />
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">Get LuckyDayze on your home screen</p>
          <Button size="sm" onClick={act}>{platform === 'android' && canPrompt ? 'Install' : 'Show me how'}</Button>
          <IconButton label="Close" onClick={close}><X size={18} strokeWidth={1.75} /></IconButton>
        </div>
      )}
      <InstallDialog open={helpOpen} onClose={() => { setHelpOpen(false); closeInstallBanner(); setPhase('out') }} />
    </>
  )
}

/** After an order: the moment they're most likely to want it. */
export function InstallCard() {
  const { canPrompt, prompt } = useInstallPrompt()
  const [show, setShow] = useState(false)
  const [android, setAndroid] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const p = installPlatform()
    /* eslint-disable react-hooks/set-state-in-effect -- device checks after mount */
    setAndroid(p === 'android')
    setShow(p !== 'desktop' && !isInstalled())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  if (!show) return null

  return (
    <aside className="flex flex-wrap items-center gap-4 rounded-3xl border border-line p-5">
      <Image src="/logo-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Reorder in two taps</p>
        <p className="text-sm text-muted">Put LuckyDayze on your home screen, like an app.</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          if (android && canPrompt) { if (await prompt()) setShow(false) } else setHelpOpen(true)
        }}
      >
        {android && canPrompt ? 'Install' : 'Show me how'}
      </Button>
      <IconButton label="Hide" className="-mr-2" onClick={() => setShow(false)}><X size={18} strokeWidth={1.75} /></IconButton>
      <InstallDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </aside>
  )
}
