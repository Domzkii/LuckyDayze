import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: Request) {
  try {
    const { customerName, customerPhone, customerAddress, total, items } = await request.json()

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    const itemsList = items.map((i: any) => `${i.emoji} ${i.name} x${i.qty}`).join(', ')

    await client.messages.create({
      body: `🌿 NEW LUCKYDAYZE ORDER!\n\nCustomer: ${customerName}\nPhone: ${customerPhone}\nAddress: ${customerAddress}\nItems: ${itemsList}\nTotal: $${total}\n\nGo to /admin to confirm!`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.TWILIO_MY_PHONE!
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('SMS error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}