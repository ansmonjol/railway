import { queryOptions } from '@tanstack/react-query'
import { getSession } from '@/functions'

// How the UI reads from the server functions: query keys and polling live here.

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    const result = await getSession()
    return result.ok ? result.data : null
  },
  staleTime: Infinity,
})
