import type { Metadata } from 'next'

// A private page shared by word of mouth: keep it out of search results.
export const metadata: Metadata = {
  title: 'Lucky Dayze',
  robots: { index: false, follow: false },
}

export default function SecretLayout({ children }: { children: React.ReactNode }) {
  return children
}
