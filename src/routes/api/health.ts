import { createFileRoute } from '@tanstack/react-router'
import { envProblems } from '@/server/env'

// Railway's healthcheck: a deploy with missing configuration never goes live.
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => {
        const missing = envProblems()
        return Response.json(
          {
            ok: missing.length === 0,
            missing,
            commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
          },
          { status: missing.length === 0 ? 200 : 503 },
        )
      },
    },
  },
})
