import { describe, expect, it } from 'vitest'
import { statusOf, toSnapshot, type RailwayEnvironment } from './snapshot'

type Node = RailwayEnvironment['serviceInstances']['edges'][number]['node']

// A complete service instance as the Snapshot query returns it.
function node(overrides: Partial<Node> & Pick<Node, 'serviceId' | 'serviceName'>): Node {
  return {
    createdAt: '2026-09-23T10:00:00.000Z',
    hasEverDeployed: true,
    source: { image: 'traefik/whoami' },
    domains: { serviceDomains: [{ domain: `${overrides.serviceName}.up.railway.app` }] },
    latestDeployment: { id: `dep-${overrides.serviceId}`, status: 'SUCCESS' },
    ...overrides,
  }
}

function environment(nodes: Node[], variables: Record<string, Record<string, string | null>> = {}) {
  const services = Object.fromEntries(
    Object.entries(variables).map(([id, vars]) => [
      id,
      { variables: Object.fromEntries(Object.entries(vars).map(([k, value]) => [k, { value }])) },
    ]),
  )
  return {
    config: { privateNetworkDisabled: false, sharedVariables: {}, services },
    serviceInstances: { edges: nodes.map((n) => ({ node: n })) },
  } satisfies RailwayEnvironment
}

describe('statusOf', () => {
  it.each([
    ['QUEUED', 'starting'],
    ['INITIALIZING', 'starting'],
    ['BUILDING', 'starting'],
    ['DEPLOYING', 'starting'],
    ['WAITING', 'starting'],
    ['NEEDS_APPROVAL', 'starting'],
    ['SUCCESS', 'running'],
    ['SLEEPING', 'sleeping'],
    ['REMOVING', 'stopping'],
    ['REMOVED', 'stopped'],
    ['FAILED', 'failed'],
    ['CRASHED', 'failed'],
    ['SKIPPED', 'unknown'],
  ] as const)('maps a %s deployment to %s', (deployment, status) => {
    expect(statusOf(deployment, true)).toBe(status)
  })

  it('treats a service whose deployments were removed as stopped', () => {
    expect(statusOf(undefined, true)).toBe('stopped')
  })

  it('treats a service that never deployed as unknown', () => {
    expect(statusOf(undefined, false)).toBe('unknown')
  })

  it('falls back to unknown for a status newer than the schema snapshot', () => {
    expect(statusOf('HIBERNATING' as never, true)).toBe('unknown')
  })
})

describe('toSnapshot', () => {
  const options = { maxServices: 3 }

  it('lists every service in the sandbox, each taking a slot', () => {
    const snapshot = toSnapshot(
      environment([
        node({ serviceId: 'svc-a', serviceName: 'whoami-calm-otter' }),
        node({ serviceId: 'svc-b', serviceName: 'created-by-hand' }),
      ]),
      options,
    )
    expect(snapshot.instances.map((i) => i.id)).toEqual(['svc-a', 'svc-b'])
    expect(snapshot.slots).toEqual({ used: 2, max: 3, free: 1 })
  })

  it('maps a running instance with who spun it up and when', () => {
    const snapshot = toSnapshot(
      environment([node({ serviceId: 'svc-a', serviceName: 'whoami-calm-otter' })], {
        'svc-a': {
          SPINNED_BY: 'Otter',
          SPINNED_AT: '2026-09-23T10:00:05.000Z',
          API_KEY: 'must-not-leak',
        },
      }),
      options,
    )
    expect(snapshot.instances).toEqual([
      {
        id: 'svc-a',
        name: 'whoami-calm-otter',
        status: 'running',
        actions: ['stop', 'restart', 'destroy'],
        url: 'https://whoami-calm-otter.up.railway.app',
        image: 'traefik/whoami',
        spinnedBy: 'Otter',
        spinnedAt: '2026-09-23T10:00:05.000Z',
        createdAt: '2026-09-23T10:00:00.000Z',
        deploymentId: 'dep-svc-a',
      },
    ])
  })

  it('leaves url, author and deployment empty when Railway has none', () => {
    const [instance] = toSnapshot(
      environment(
        [
          node({
            serviceId: 'svc-b',
            serviceName: 'manual',
            domains: { serviceDomains: [] },
            latestDeployment: null,
          }),
        ],
        { 'svc-b': { SPINNED_BY: null } },
      ),
      options,
    ).instances
    expect(instance).toMatchObject({
      status: 'stopped',
      actions: ['start', 'destroy'],
      url: null,
      spinnedBy: null,
      spinnedAt: null,
      deploymentId: null,
    })
  })

  it('only allows destroy while an instance is changing state', () => {
    const snapshot = toSnapshot(
      environment([
        node({
          serviceId: 'svc-a',
          serviceName: 'a',
          latestDeployment: { id: 'd1', status: 'BUILDING' },
        }),
        node({
          serviceId: 'svc-b',
          serviceName: 'b',
          latestDeployment: { id: 'd2', status: 'REMOVING' },
        }),
      ]),
      options,
    )
    expect(snapshot.instances.map((i) => i.actions)).toEqual([['destroy'], ['destroy']])
  })

  it('shows an instance being destroyed as destroying, with no action, still in the slot count', () => {
    const snapshot = toSnapshot(
      environment([
        node({
          serviceId: 'svc-a',
          serviceName: 'a',
          latestDeployment: null,
          domains: { serviceDomains: [] },
        }),
      ]),
      { ...options, destroyingServiceIds: ['svc-a'] },
    )
    expect(snapshot.instances[0]).toMatchObject({ status: 'destroying', actions: [] })
    expect(snapshot.slots).toEqual({ used: 1, max: 3, free: 2 })
  })

  it('lists the newest instances first', () => {
    const snapshot = toSnapshot(
      environment([
        node({ serviceId: 'old', serviceName: 'old', createdAt: '2026-09-23T09:00:00.000Z' }),
        node({ serviceId: 'new', serviceName: 'new', createdAt: '2026-09-23T11:00:00.000Z' }),
      ]),
      options,
    )
    expect(snapshot.instances.map((i) => i.id)).toEqual(['new', 'old'])
  })

  it('never reports negative free slots', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => node({ serviceId: id, serviceName: id }))
    expect(toSnapshot(environment(nodes), options).slots).toEqual({ used: 4, max: 3, free: 0 })
  })
})
