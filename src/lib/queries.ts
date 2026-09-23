import { queryOptions } from '@tanstack/react-query'
import { getSession, getSnapshot } from '@/functions'
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
