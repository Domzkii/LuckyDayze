import { Resend } from 'resend'
import { formatDay, formatPhone, money, weightLabel } from '@/lib/format'
import type { Discount, Fulfillment, OrderItem } from '@/lib/types'

const escape = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

interface NewOrderEmail {
  origin: string
  kind: 'order' | 'scheduled'
  fulfillment: Fulfillment
  name: string
  phone: string
  place: string
  items: OrderItem[]
  discounts: Discount[]
  total: number
  deliveryDate?: string
  timeWindow?: string | null
  frequency?: string
}

/** Emails the owner about a new order. Never throws: a failed email must not fail the order. */
export async function notifyNewOrder(o: NewOrderEmail) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.ORDER_NOTIFY_EMAIL
  if (!key || !to) return

  const lines = o.items
    .map(i => `${escape(i.name)}${i.weight ? ` (${weightLabel(i.weight)})` : ''} × ${i.qty}${i.is_reward ? ' — reward' : ''}`)
    .join('<br>')
  const discounts = o.discounts.map(d => `${escape(d.label)}: −${money(d.amount, { cents: true })}`).join('<br>')
  const when = o.kind === 'scheduled' && o.deliveryDate
    ? `<p><strong>Scheduled:</strong> ${formatDay(o.deliveryDate)}${o.timeWindow ? `, ${escape(o.timeWindow)}` : ''} (${escape(o.frequency || 'once')})</p>`
    : ''

  try {
    await new Resend(key).emails.send({
      from: process.env.ORDER_NOTIFY_FROM || 'LuckyDayze <onboarding@resend.dev>',
      to,
      subject: `New ${o.kind === 'scheduled' ? 'scheduled ' : ''}${o.fulfillment === 'pickup' ? 'pickup' : 'order'}: ${money(o.total, { cents: true })} from ${o.name}`,
      html: `
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1814;">
          <h2 style="font-family: Georgia, serif; font-weight: 600; margin: 0 0 16px;">New LuckyDayze order</h2>
          <div style="background: #f4efe6; padding: 20px; border-radius: 16px; line-height: 1.6;">
            <p><strong>Customer:</strong> ${escape(o.name)}</p>
            <p><strong>Phone:</strong> ${escape(formatPhone(o.phone))}</p>
            <p><strong>${o.fulfillment === 'pickup' ? 'Pickup at' : 'Deliver to'}:</strong> ${escape(o.place)}</p>
            ${when}
            <p><strong>Items:</strong><br>${lines}</p>
            ${discounts ? `<p><strong>Discounts:</strong><br>${discounts}</p>` : ''}
            <p style="font-size: 18px;"><strong>Total: ${money(o.total, { cents: true })}</strong></p>
          </div>
          <a href="${o.origin}/admin" style="display: inline-block; margin-top: 20px; background: #1a1814; color: #f4efe6; font-weight: 600; padding: 14px 28px; border-radius: 999px; text-decoration: none;">Open admin</a>
        </div>`,
    })
  } catch (err) {
    console.error('Order email failed', err)
  }
}
