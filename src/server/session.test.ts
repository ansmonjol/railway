import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PERSONAS, createSession, isValidAccessCode, signSession, verifySession } from './session'

const SECRET = 'test-secret-with-enough-entropy'
const NOW = Date.UTC(2026, 8, 23, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

// Builds a correctly signed token around an arbitrary payload, independently of session.ts.
function forge(payload: string, secret = SECRET) {
  const body = Buffer.from(payload).toString('base64url')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

describe('signSession / verifySession', () => {
  it('round-trips a session', () => {
    const session = { persona: 'Otter', exp: NOW + DAY }
    expect(verifySession(signSession(session, SECRET), SECRET, NOW)).toEqual(session)
  })

  it('rejects a token signed with another secret', () => {
    const token = signSession({ persona: 'Otter', exp: NOW + DAY }, 'another-secret')
    expect(verifySession(token, SECRET, NOW)).toBeNull()
  })

  it('rejects a payload swapped under an existing signature', () => {
    const token = signSession({ persona: 'Otter', exp: NOW + DAY }, SECRET)
    const signature = token.split('.')[1]
    const swapped = Buffer.from(JSON.stringify({ persona: 'Fox', exp: NOW + DAY })).toString(
      'base64url',
    )
    expect(verifySession(`${swapped}.${signature}`, SECRET, NOW)).toBeNull()
  })

  it('rejects an expired session', () => {
    const token = signSession({ persona: 'Otter', exp: NOW - 1 }, SECRET)
    expect(verifySession(token, SECRET, NOW)).toBeNull()
  })

  it.each([undefined, '', 'no-dot', 'a.b.c', '.sig', 'payload.'])(
    'rejects the malformed token %j',
    (token) => {
      expect(verifySession(token, SECRET, NOW)).toBeNull()
    },
  )

  it('rejects a signed payload that is not JSON', () => {
    expect(verifySession(forge('not json'), SECRET, NOW)).toBeNull()
  })

  it('rejects a signed payload with the wrong shape', () => {
    expect(
      verifySession(forge(JSON.stringify({ persona: 42, exp: 'soon' })), SECRET, NOW),
    ).toBeNull()
  })
})

describe('createSession', () => {
  it('picks a known persona and lasts seven days', () => {
    const session = createSession(NOW)
    expect(PERSONAS).toContain(session.persona)
    const token = signSession(session, SECRET)
    expect(verifySession(token, SECRET, NOW + 7 * DAY - 1)).not.toBeNull()
    expect(verifySession(token, SECRET, NOW + 7 * DAY + 1)).toBeNull()
  })
})

describe('isValidAccessCode', () => {
  it('accepts the exact code', () => {
    expect(isValidAccessCode('open-sesame', 'open-sesame')).toBe(true)
  })

  it('rejects a code of the same length', () => {
    expect(isValidAccessCode('open-sesamE', 'open-sesame')).toBe(false)
  })

  it('rejects codes of another length without throwing', () => {
    expect(isValidAccessCode('open', 'open-sesame')).toBe(false)
    expect(isValidAccessCode('', 'open-sesame')).toBe(false)
  })
})
