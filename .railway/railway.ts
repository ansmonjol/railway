import { defineRailway, github, preserve, project, service } from 'railway/iac'

// This file owns only the dashboard service. The instances it spins up at runtime
// live in the same project and are left alone by `railway config apply`.
export const partial = 'dashboard'

export default defineRailway((ctx) => {
  if (!ctx.projectId || !ctx.environmentId) throw new Error('Link a project first: railway link')

  const dashboard = service('dashboard', {
    source: github('ansmonjol/railway', { branch: 'main' }),
    build: { builder: 'RAILPACK' },
    healthcheck: '/api/health',
    env: {
      // The dashboard manages the project it runs in.
      SANDBOX_PROJECT_ID: ctx.projectId,
      SANDBOX_ENVIRONMENT_ID: ctx.environmentId,
      SANDBOX_MAX_SERVICES: '3',
      // Secrets are set once with `railway variable set --stdin` and never live in git.
      RAILWAY_API_TOKEN: preserve(),
      ACCESS_CODE: preserve(),
      SESSION_SECRET: preserve(),
    },
  })

  return project('railway-sandbox', { resources: [dashboard] })
})
