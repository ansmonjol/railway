import '@tanstack/react-start/server-only'
import { z } from 'zod'
import { AppError } from '@/lib/result'

const schema = z.object({
  RAILWAY_API_TOKEN: z.string().min(1),
  ACCESS_CODE: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SANDBOX_PROJECT_ID: z.string().min(1),
  SANDBOX_ENVIRONMENT_ID: z.string().min(1),
  SANDBOX_MAX_SERVICES: z.coerce.number().int().min(1).default(4),
})

export type Env = z.infer<typeof schema>

export function env(source = process.env): Env {
  const parsed = schema.safeParse(source)
  if (!parsed.success) throw new AppError(`Server misconfigured: ${envProblems(source).join(', ')}`)
  return parsed.data
}

// Names (never values) of the variables that are missing or invalid.
export function envProblems(source = process.env): string[] {
  const parsed = schema.safeParse(source)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'))
}
