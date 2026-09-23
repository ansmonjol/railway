import { describe, expect, it } from 'vitest'
import { env } from './env'

// Every variable env() requires, with placeholder values.
const REQUIRED = {
  RAILWAY_API_TOKEN: 'token',
  ACCESS_CODE: 'code',
  SESSION_SECRET: 'x'.repeat(32),
  SANDBOX_PROJECT_ID: 'project',
  SANDBOX_ENVIRONMENT_ID: 'environment',
}

describe('env', () => {
  it('gives the sandbox 4 instance slots when SANDBOX_MAX_SERVICES is unset', () => {
    expect(env(REQUIRED).SANDBOX_MAX_SERVICES).toBe(4)
  })
})
