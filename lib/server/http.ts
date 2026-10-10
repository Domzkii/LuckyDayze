import { NextResponse } from 'next/server'

export class InputError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Runs a route body, turning InputError into a 4xx and anything else into a logged 500. */
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof InputError) return fail(err.message, err.status)
    console.error(err)
    return fail('Something went wrong on our end. Please try again in a moment.', 500)
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {}
  throw new InputError('Invalid request.')
}

export function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function randomCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}
