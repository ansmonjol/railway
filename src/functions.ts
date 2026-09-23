import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { generateName, slugify } from '@/lib/names'
import { AppError, UNAUTHENTICATED, type Result } from '@/lib/result'
import { env } from '@/server/env'
import {
  DeploymentLogsQuery,
  DeploymentRemove,
  DeploymentRestart,
  DeploymentsQuery,
  MetricsQuery,
  ServiceCreate,
  ServiceDelete,
  ServiceDomainCreate,
  ServiceInstanceDeploy,
  SnapshotQuery,
} from '@/server/operations'
import { railway } from '@/server/railway'
import {
  SESSION_MAX_AGE_S,
  createSession,
  isValidAccessCode,
  signSession,
  verifySession,
  type Session,
} from '@/server/session'
import { statusOf, toSnapshot, type Action, type Instance, type Snapshot } from '@/server/snapshot'

// The only boundary between the browser and the server: every call to Railway
// goes through one of these functions, and every one of them returns a Result.

const COOKIE = 'session'
const IMAGE = 'traefik/whoami'
const LOG_LINES = 200
const SNAPSHOT_TTL_MS = 2_000
const METRICS_WINDOW_MS = 60 * 60 * 1000
const DESTROYING_TTL_MS = 2 * 60 * 1000

const byServiceId = z.object({ serviceId: z.string().min(1) })

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

export const getSnapshot = createServerFn({ method: 'GET' }).handler(() =>
  authed(() => loadSnapshot()),
)

export const spinUp = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().max(200).optional() }))
  .handler(({ data }) =>
    authed(async (session) => {
      const { SANDBOX_PROJECT_ID: projectId, SANDBOX_ENVIRONMENT_ID: environmentId } = env()
      const snapshot = await loadSnapshot({ fresh: true })
      if (snapshot.slots.free === 0) {
        throw new AppError(`All ${snapshot.slots.max} slots are in use. Destroy an instance first.`)
      }
      const taken = new Set(snapshot.instances.map((instance) => instance.name))
      const name = data.name === undefined ? generateName(taken) : slugify(data.name)
      if (!name) throw new AppError('The name needs at least one letter or digit.')

      // Who and when come from the session cookie, never from the request body.
      const { serviceCreate } = await railway(ServiceCreate, {
        input: {
          projectId,
          environmentId,
          name,
          source: { image: IMAGE },
          variables: { SPINNED_BY: session.persona, SPINNED_AT: new Date().toISOString() },
        },
      })
      // Creating a service never deploys it: give it a public domain, then deploy.
      await railway(ServiceDomainCreate, {
        input: { serviceId: serviceCreate.id, environmentId, targetPort: 80 },
      })
      await railway(ServiceInstanceDeploy, { serviceId: serviceCreate.id, environmentId })
      snapshotCache = null
      return { id: serviceCreate.id, name }
    }),
  )

export const stop = createServerFn({ method: 'POST' })
  .validator(byServiceId)
  .handler(({ data }) =>
    perform(data.serviceId, 'stop', (instance) =>
      railway(DeploymentRemove, { id: deploymentOf(instance) }),
    ),
  )

export const start = createServerFn({ method: 'POST' })
  .validator(byServiceId)
  .handler(({ data }) =>
    perform(data.serviceId, 'start', (instance) =>
      railway(ServiceInstanceDeploy, {
        serviceId: instance.id,
        environmentId: env().SANDBOX_ENVIRONMENT_ID,
      }),
    ),
  )

export const restart = createServerFn({ method: 'POST' })
  .validator(byServiceId)
  .handler(({ data }) =>
    perform(data.serviceId, 'restart', (instance) =>
      railway(DeploymentRestart, { id: deploymentOf(instance) }),
    ),
  )

export const destroy = createServerFn({ method: 'POST' })
  .validator(byServiceId)
  .handler(({ data }) =>
    perform(data.serviceId, 'destroy', async (instance) => {
      await railway(ServiceDelete, {
        id: instance.id,
        environmentId: env().SANDBOX_ENVIRONMENT_ID,
      })
      destroying.set(instance.id, Date.now() + DESTROYING_TTL_MS)
    }),
  )

export const getLogs = createServerFn({ method: 'GET' })
  .validator(byServiceId)
  .handler(({ data }) =>
    authed(async () => {
      const instance = await findInstance(data.serviceId)
      if (!instance.deploymentId) return []
      const { deploymentLogs } = await railway(DeploymentLogsQuery, {
        deploymentId: instance.deploymentId,
        limit: LOG_LINES,
      })
      return deploymentLogs
    }),
  )

export const getDeployments = createServerFn({ method: 'GET' })
  .validator(byServiceId)
  .handler(({ data }) =>
    authed(async () => {
      const instance = await findInstance(data.serviceId)
      const { SANDBOX_PROJECT_ID: projectId, SANDBOX_ENVIRONMENT_ID: environmentId } = env()
      const { deployments } = await railway(DeploymentsQuery, {
        input: { projectId, environmentId, serviceId: instance.id },
      })
      return deployments.edges.map(({ node }) => ({
        id: node.id,
        status: statusOf(node.status, true),
        createdAt: node.createdAt,
      }))
    }),
  )

export const getMetrics = createServerFn({ method: 'GET' })
  .validator(byServiceId)
  .handler(({ data }) =>
    authed(async () => {
      const instance = await findInstance(data.serviceId)
      const to = Date.now()
      const from = to - METRICS_WINDOW_MS
      const { metrics } = await railway(MetricsQuery, {
        environmentId: env().SANDBOX_ENVIRONMENT_ID,
        serviceId: instance.id,
        startDate: new Date(from).toISOString(),
      })
      // Railway sends epoch seconds and gigabytes; the chart wants milliseconds and MB.
      const points = (measurement: string, scale: number) =>
        (metrics.find((metric) => metric.measurement === measurement)?.values ?? []).map(
          ({ ts, value }) => ({ ts: ts * 1000, value: value * scale }),
        )
      return { from, to, cpu: points('CPU_USAGE', 1), memoryMb: points('MEMORY_USAGE_GB', 1000) }
    }),
  )

// Several tabs polling at once cost one Railway call: a snapshot is shared for
// 2 s, including while its request is still in flight. Writes read it fresh and
// drop it afterwards so the next poll sees their effect.
let snapshotCache: { at: number; promise: Promise<Snapshot> } | null = null

// Services this server asked Railway to delete, until Railway has removed them.
const destroying = new Map<string, number>()

function loadSnapshot({ fresh = false } = {}): Promise<Snapshot> {
  if (!fresh && snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return snapshotCache.promise
  }
  const { SANDBOX_ENVIRONMENT_ID, SANDBOX_MAX_SERVICES, RAILWAY_SERVICE_ID } = env()
  for (const [id, until] of destroying) if (until < Date.now()) destroying.delete(id)
  const promise = railway(SnapshotQuery, { environmentId: SANDBOX_ENVIRONMENT_ID }).then(
    ({ environment }) =>
      toSnapshot(environment, {
        excludedServiceIds: RAILWAY_SERVICE_ID ? [RAILWAY_SERVICE_ID] : [],
        destroyingServiceIds: [...destroying.keys()],
        maxServices: SANDBOX_MAX_SERVICES,
      }),
  )
  snapshotCache = { at: Date.now(), promise }
  promise.catch(() => {
    if (snapshotCache?.promise === promise) snapshotCache = null
  })
  return promise
}

// Excluded services never appear in a snapshot, so they can never be targeted.
async function findInstance(serviceId: string, options?: { fresh?: boolean }) {
  const snapshot = await loadSnapshot(options)
  const instance = snapshot.instances.find((candidate) => candidate.id === serviceId)
  if (!instance) throw new AppError('This instance is not in the sandbox.')
  return instance
}

function perform(serviceId: string, action: Action, run: (instance: Instance) => Promise<unknown>) {
  return authed(async () => {
    const instance = await findInstance(serviceId, { fresh: true })
    if (!instance.actions.includes(action)) {
      throw new AppError(`Can't ${action} ${instance.name} while it is ${instance.status}.`)
    }
    await run(instance)
    snapshotCache = null
    return null
  })
}

function deploymentOf(instance: Instance) {
  if (!instance.deploymentId) throw new AppError(`${instance.name} has no deployment.`)
  return instance.deploymentId
}

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
