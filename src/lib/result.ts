// What every server function returns: failures are values, never exceptions
// thrown across the network boundary.
export type Failure = { ok: false; message: string; traceId?: string; code?: string }
export type Result<T> = { ok: true; data: T } | Failure

export const UNAUTHENTICATED = 'UNAUTHENTICATED'

// Server side: thrown for expected failures (Railway errors, broken rules) and
// turned into a Failure by the server function wrapper.
// Client side: rethrown by `unwrap` so TanStack Query treats it as an error.
export class AppError extends Error {
  constructor(
    message: string,
    readonly traceId?: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.data
  throw new AppError(result.message, result.traceId, result.code)
}
