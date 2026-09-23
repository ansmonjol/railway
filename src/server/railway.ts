import '@tanstack/react-start/server-only'
import { print } from '@0no-co/graphql.web'
import type { TadaDocumentNode } from 'gql.tada'
import { AppError } from '@/lib/result'
import { env } from './env'

const ENDPOINT = 'https://backboard.railway.com/graphql/v2'
// serviceInstanceDeployV2 sometimes takes 20 s to answer.
const TIMEOUT_MS = 30_000

type GraphQLError = { message: string; traceId?: string; extensions?: { code?: string } }
type GraphQLResponse<T> = { data?: T | null; errors?: GraphQLError[] }

// After a 429, calls fail fast until Retry-After passes instead of spending the
// hourly quota (1000 requests) on requests Railway will refuse anyway.
let blockedUntil = 0

export async function railway<Result, Variables>(
  document: TadaDocumentNode<Result, Variables>,
  variables: Variables,
): Promise<Result> {
  if (Date.now() < blockedUntil) throw rateLimited()

  const token = env().RAILWAY_API_TOKEN
  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
      body: JSON.stringify({ query: print(document), variables }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new AppError('Railway did not answer in time. The action may still complete.')
    }
    throw new AppError('Could not reach Railway.')
  }

  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After'))
    blockedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000
    throw rateLimited()
  }

  // GraphQL errors arrive with HTTP 200, each with a traceId Railway can look up.
  const body = (await response.json().catch(() => null)) as GraphQLResponse<Result> | null
  const error = body?.errors?.[0]
  if (error) throw new AppError(error.message, error.traceId, error.extensions?.code)
  if (!response.ok || !body?.data) throw new AppError(`Railway answered HTTP ${response.status}`)
  return body.data
}

function rateLimited() {
  const seconds = Math.ceil((blockedUntil - Date.now()) / 1000)
  return new AppError(`Railway rate limit reached, retry in ${seconds}s`, undefined, 'RATE_LIMITED')
}
