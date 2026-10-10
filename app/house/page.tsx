import { redirect } from 'next/navigation'

// The House now lives on the rewards page. This keeps old links and home-screen shortcuts working.
export default function HousePage() {
  redirect('/rewards')
}
