'use client'

import { useEffect, useState } from 'react'

/**
 * "Add to home screen" support. Android Chrome lets us show a real Install button
 * (beforeinstallprompt); iPhone doesn't, so there we show the steps.
 */

export type InstallPlatform = 'ios-safari' | 'ios-chrome' | 'ios-other' | 'android' | 'desktop'

export function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away.
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  if (ios) {
    if (/crios/i.test(ua)) return 'ios-chrome'
    if (/fxios|edgios|opios|gsa\//i.test(ua)) return 'ios-other'
    return 'ios-safari'
  }
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

/** True when the site is already running from the home screen. */
export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome fires this once, early, so catch it as soon as this module loads.
let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(fn => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    notify()
  })
}

/** Android's one-tap install, when the browser offers it. */
export function useInstallPrompt() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  return {
    canPrompt: !!deferred,
    justInstalled: installed,
    /** Shows Android's install dialog. Resolves true if they installed. */
    async prompt() {
      const e = deferred
      if (!e) return false
      deferred = null
      await e.prompt()
      const { outcome } = await e.userChoice
      notify()
      return outcome === 'accepted'
    },
  }
}
