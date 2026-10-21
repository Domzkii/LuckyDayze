import type { Metadata } from 'next'

// Saving the back office to the home screen installs its own app that opens on /admin,
// separate from the customer app, so staff can get push alerts there.
export const metadata: Metadata = {
  title: 'LuckyDayze Office',
  manifest: '/office-manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'LD Office' },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
