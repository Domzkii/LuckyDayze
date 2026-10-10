import type { Metadata, Viewport } from 'next'
import { Bodoni_Moda, Hanken_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme'
import { CartProvider } from '@/components/cart'
import './globals.css'

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  axes: ['opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe6' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0d0b' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'LuckyDayze — NYC Cannabis Delivery',
  description: 'Premium flower and pre-rolls, delivered to your door.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LuckyDayze',
  },
  icons: {
    apple: '/logo-192.png',
  },
}

// Applies the saved (or system) theme before first paint so dark-mode visitors never see a light flash.
const themeScript = `(function(){try{var t=localStorage.getItem('ld_theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.add(t)}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <ThemeProvider>
          <CartProvider>{children}</CartProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
