import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { logout } from '@/functions'
import { sessionQuery } from '@/lib/queries'
import { unwrap } from '@/lib/result'

export const Route = createFileRoute('/instances')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) throw redirect({ to: '/' })
    return { persona: session.persona }
  },
  component: InstancesPage,
})

function InstancesPage() {
  const { persona } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signOut = useMutation({
    mutationFn: () => logout().then(unwrap),
    onSuccess: async () => {
      queryClient.clear()
      await navigate({ to: '/' })
    },
  })

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="font-medium">Railway sandbox</span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{persona}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut.mutate()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        Instances will be listed here.
      </main>
    </div>
  )
}
