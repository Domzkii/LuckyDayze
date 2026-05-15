import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { customerName, customerPhone, customerAddress, total, items } = await request.json()

    const itemsList = items.map((i: any) => `${i.emoji} ${i.name} x${i.qty}`).join(', ')

    await resend.emails.send({
      from: 'LuckyDayze <onboarding@resend.dev>',
      to: 'dominic.ojeda77@gmail.com',
      subject: `New Order — $${total} from ${customerName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #c9a84c;">🌿 New LuckyDayze Order!</h2>
          <div style="background: #1c201e; color: #f0ede6; padding: 20px; border-radius: 12px; margin: 16px 0;">
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Phone:</strong> ${customerPhone}</p>
            <p><strong>Address:</strong> ${customerAddress}</p>
            <p><strong>Items:</strong> ${itemsList}</p>
            <p><strong>Total:</strong> $${total}</p>
          </div>
          <a href="https://lucky-dayze.vercel.app/admin" style="display: inline-block; background: #c9a84c; color: #000; font-weight: bold; padding: 14px 28px; border-radius: 50px; text-decoration: none; margin-top: 8px;">
            View Order in Admin →
          </a>
          <p style="color: #888; margin-top: 16px; font-size: 12px;">LuckyDayze · New York Cannabis House</p>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}