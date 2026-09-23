import { queryOptions } from '@tanstack/react-query'
import { getDeployments, getLogs, getMetrics, getSession, getSnapshot } from '@/functions'
import { unwrap } from '@/lib/result'

// How the UI reads from the server functions: query keys and polling live here.

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    const result = await getSession()
    return result.ok ? result.data : null
  },
  staleTime: Infinity,
})

// Railway can take several seconds to reflect a write (a start can answer before
// its deployment shows up), so the list polls fast for a while after each one.
let lastWriteAt = 0
export function noteWrite() {
  lastWriteAt = Date.now()
}

export const snapshotQuery = queryOptions({
  queryKey: ['snapshot'],
  queryFn: () => getSnapshot().then(unwrap),
  // Poll fast while an instance is changing state or right after a write, slowly otherwise.
  refetchInterval: (query) => {
    const changing = query.state.data?.instances.some((i) =>
      ['starting', 'stopping', 'destroying'].includes(i.status),
    )
    return changing || Date.now() - lastWriteAt < 20_000 ? 3_000 : 15_000
  },
})

// Mounted only while the Logs tab is open, and paused while the browser tab is hidden.
export const logsQuery = (serviceId: string) =>
  queryOptions({
    queryKey: ['logs', serviceId],
    queryFn: () => getLogs({ data: { serviceId } }).then(unwrap),
    refetchInterval: 5_000,
  })

export const deploymentsQuery = (serviceId: string) =>
  queryOptions({
    queryKey: ['deployments', serviceId],
    queryFn: () => getDeployments({ data: { serviceId } }).then(unwrap),
  })

// Railway samples once a minute, so polling faster would only repeat the same points.
export const metricsQuery = (serviceId: string) =>
  queryOptions({
    queryKey: ['metrics', serviceId],
    queryFn: () => getMetrics({ data: { serviceId } }).then(unwrap),
    refetchInterval: 60_000,
  })
