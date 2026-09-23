import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { AppError, UNAUTHENTICATED, type Result } from '@/lib/result'
import { env } from '@/server/env'
import {
  SESSION_MAX_AGE_S,
  createSession,
  isValidAccessCode,
  signSession,
  verifySession,
  type Session,
} from '@/server/session'

// The only boundary between the browser and the server: every call to Railway
// goes through one of these functions, and every one of them returns a Result.

const COOKIE = 'session'

export const login = createServerFn({ method: 'POST' })
  .validator(z.object({ code: z.string().max(200) }))
  .handler(({ data }) =>
    run(() => {
      const { ACCESS_CODE, SESSION_SECRET } = env()
      if (!isValidAccessCode(data.code, ACCESS_CODE)) throw new AppError('Wrong access code')
      const session = createSession()
      setCookie(COOKIE, signSession(session, SESSION_SECRET), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE_S,
      })
      return { persona: session.persona }
    }),
  )

export const logout = createServerFn({ method: 'POST' }).handler(() =>
  run(() => {
    deleteCookie(COOKIE, { path: '/' })
    return null
  }),
)

export const getSession = createServerFn({ method: 'GET' }).handler(() =>
  authed((session) => ({ persona: session.persona })),
)

async function run<T>(fn: () => T | Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, message: error.message, traceId: error.traceId, code: error.code }
    }
    console.error(error)
    return { ok: false, message: 'Unexpected server error' }
  }
}

function authed<T>(fn: (session: Session) => T | Promise<T>): Promise<Result<T>> {
  return run(() => {
    const session = verifySession(getCookie(COOKIE), env().SESSION_SECRET)
    if (!session) throw new AppError('Please sign in again.', undefined, UNAUTHENTICATED)
    return fn(session)
  })
}
