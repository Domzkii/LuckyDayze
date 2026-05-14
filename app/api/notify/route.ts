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
      body: `New order received!\n\nCustomer: ${customerName}\nPhone: ${customerPhone}\nAddress: ${customerAddress}\nItems: ${itemsList}\nTotal: $${total}\n\nCheck admin panel to confirm.`,
      from: '+18665823069',
      to: process.env.TWILIO_MY_PHONE!
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('SMS error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}