import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AppError, UNAUTHENTICATED } from '@/lib/result'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // Failures are handled once, here: an expired session goes back to the login
  // screen, and a failed action becomes a toast carrying Railway's trace ID.
  const onError = (error: Error, toastIt: boolean) => {
    if (error instanceof AppError && error.code === UNAUTHENTICATED) {
      queryClient.clear()
      void router.navigate({ to: '/' })
    } else if (toastIt) {
      const traceId = error instanceof AppError ? error.traceId : undefined
      // Long enough to read, or copy, the trace ID.
      toast.error(error.message, {
        description: traceId && `Railway trace ID: ${traceId}`,
        duration: 10_000,
      })
    }
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => onError(error, false) }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        onError(error, mutation.meta?.silent !== true),
    }),
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
