import '@tanstack/react-start/server-only'
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'

// The cookie is `<base64url JSON payload>.<base64url HMAC-SHA256 of the payload>`.
export type Session = { persona: string; exp: number }

export const PERSONAS = ['Otter', 'Heron', 'Lynx', 'Fox', 'Crane', 'Badger', 'Wren', 'Marten']
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60

export function createSession(now = Date.now()): Session {
  const persona = PERSONAS[randomInt(PERSONAS.length)] ?? 'Otter'
  return { persona, exp: now + SESSION_MAX_AGE_S * 1000 }
}

export function signSession(session: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Session | null {
  const [payload, signature, ...rest] = token?.split('.') ?? []
  if (!payload || !signature || rest.length > 0) return null
  if (!safeEqual(signature, sign(payload, secret))) return null

  try {
    const session: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!isSession(session) || session.exp <= now) return null
    return session
  } catch {
    return null
  }
}

// Hashing both sides first gives equal-length buffers, so the comparison
// neither throws nor leaks the code's length.
export function isValidAccessCode(input: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(input), digest(expected))
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const { persona, exp } = value as Record<string, unknown>
  return typeof persona === 'string' && typeof exp === 'number'
}
