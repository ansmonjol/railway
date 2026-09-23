import type { ResultOf } from 'gql.tada'
import type { SnapshotQuery } from './operations'

// Pure: turns the Snapshot query result into what the UI renders. The UI only
// imports the types below; the actions list is the rule the server enforces.

export type Status =
  'starting' | 'running' | 'sleeping' | 'stopping' | 'stopped' | 'failed' | 'destroying' | 'unknown'
export type Action = 'start' | 'stop' | 'restart' | 'destroy'

export type Instance = {
  id: string
  name: string
  status: Status
  actions: Action[]
  url: string | null
  image: string | null
  spinnedBy: string | null
  spinnedAt: string | null
  createdAt: string
  deploymentId: string | null
}

export type Snapshot = {
  instances: Instance[]
  slots: { used: number; max: number; free: number }
}

export type RailwayEnvironment = ResultOf<typeof SnapshotQuery>['environment']
type ServiceNode = RailwayEnvironment['serviceInstances']['edges'][number]['node']
type DeploymentStatus = NonNullable<ServiceNode['latestDeployment']>['status']

// A Record over the schema's enum: refreshing the schema flags any new status here.
const STATUS: Record<DeploymentStatus, Status> = {
  QUEUED: 'starting',
  INITIALIZING: 'starting',
  BUILDING: 'starting',
  DEPLOYING: 'starting',
  WAITING: 'starting',
  NEEDS_APPROVAL: 'starting',
  SUCCESS: 'running',
  SLEEPING: 'sleeping',
  REMOVING: 'stopping',
  REMOVED: 'stopped',
  FAILED: 'failed',
  CRASHED: 'failed',
  SKIPPED: 'unknown',
}

const ACTIONS: Record<Status, Action[]> = {
  running: ['stop', 'restart', 'destroy'],
  sleeping: ['stop', 'restart', 'destroy'],
  starting: ['destroy'],
  stopping: ['destroy'],
  stopped: ['start', 'destroy'],
  failed: ['start', 'destroy'],
  destroying: [],
  unknown: ['start', 'destroy'],
}

export function statusOf(
  deployment: DeploymentStatus | undefined,
  hasEverDeployed: boolean,
): Status {
  // Stopping removes the deployment, so "no deployment" means stopped once it has ever run.
  if (!deployment) return hasEverDeployed ? 'stopped' : 'unknown'
  // Railway may send a status newer than the schema snapshot.
  return STATUS[deployment] ?? 'unknown'
}

export function toSnapshot(
  environment: RailwayEnvironment,
  options: { excludedServiceIds: string[]; destroyingServiceIds?: string[]; maxServices: number },
): Snapshot {
  const excluded = new Set(options.excludedServiceIds)
  // Railway tears a service down in about ten seconds (domain, deployment, then the
  // service itself); meanwhile it would look stopped and offer Start.
  const destroying = new Set(options.destroyingServiceIds)
  const instances = environment.serviceInstances.edges
    .map(({ node }) => node)
    .filter((node) => !excluded.has(node.serviceId))
    .map((node): Instance => {
      const status = destroying.has(node.serviceId)
        ? 'destroying'
        : statusOf(node.latestDeployment?.status, node.hasEverDeployed)
      const domain = node.domains.serviceDomains[0]?.domain
      return {
        id: node.serviceId,
        name: node.serviceName,
        status,
        actions: ACTIONS[status],
        url: domain ? `https://${domain}` : null,
        image: node.source?.image ?? null,
        spinnedBy: variable(environment.config, node.serviceId, 'SPINNED_BY'),
        spinnedAt: variable(environment.config, node.serviceId, 'SPINNED_AT'),
        createdAt: node.createdAt,
        deploymentId: node.latestDeployment?.id ?? null,
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const used = instances.length
  const max = options.maxServices
  return { instances, slots: { used, max, free: Math.max(0, max - used) } }
}

// The environment config is untyped JSON: config.services[id].variables[KEY].value.
type EnvironmentConfig = {
  services?: Record<string, { variables?: Record<string, { value?: unknown } | null> } | null>
}

function variable(config: unknown, serviceId: string, key: string): string | null {
  const value = (config as EnvironmentConfig | null)?.services?.[serviceId]?.variables?.[key]?.value
  return typeof value === 'string' ? value : null
}
