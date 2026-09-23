import { defineRailway, github, preserve, project, service } from 'railway/iac'

// This file describes the whole Dashboard project, which holds only the dashboard.
// Instances live in the Sandboxes project: the dashboard's RAILWAY_API_TOKEN is a
// project token of Sandboxes, so it can never read the dashboard's own secrets.
const SANDBOX = {
  projectId: 'd75f63c7-95ae-47bf-9be8-dd435e06dc7c',
  environmentId: '1ebdd006-7618-4e1a-8ad0-549b972147d4',
}

export default defineRailway((ctx) => {
  // A whole-project apply deletes what the file leaves out: in the sandbox, every instance.
  if (ctx.projectId === SANDBOX.projectId) {
    throw new Error('Linked to the Sandboxes project: railway link the Dashboard project instead')
  }

  const dashboard = service('dashboard', {
    // Wait for CI: a deploy waits for its commit's GitHub Actions runs and is skipped if one fails.
    source: github('ansmonjol/railway', { branch: 'main', checkSuites: true }),
    build: { builder: 'RAILPACK' },
    healthcheck: '/api/health',
    env: {
      SANDBOX_PROJECT_ID: SANDBOX.projectId,
      SANDBOX_ENVIRONMENT_ID: SANDBOX.environmentId,
      SANDBOX_MAX_SERVICES: '4',
      // Secrets are set once with `railway variable set --stdin` and never live in git.
      RAILWAY_API_TOKEN: preserve(),
      ACCESS_CODE: preserve(),
      SESSION_SECRET: preserve(),
    },
  })

  return project('Dashboard', { resources: [dashboard] })
})
