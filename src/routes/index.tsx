import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/functions'
import { sessionQuery } from '@/lib/queries'
import { unwrap } from '@/lib/result'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (session) throw redirect({ to: '/instances' })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const signIn = useMutation({
    mutationFn: (code: string) => login({ data: { code } }).then(unwrap),
    meta: { silent: true }, // shown inline under the field instead of as a toast
    onSuccess: async (session) => {
      queryClient.setQueryData(sessionQuery.queryKey, session)
      await navigate({ to: '/instances' })
    },
  })

  return (
    <main className="grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Railway sandbox</CardTitle>
          <CardDescription>Spin containers up and down on Railway.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              signIn.mutate(code)
            }}
          >
            <Label htmlFor="code">Access code</Label>
            <Input
              id="code"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={code}
              aria-invalid={signIn.isError}
              onChange={(event) => setCode(event.target.value)}
            />
            {signIn.isError ? (
              <p className="text-sm text-destructive">{signIn.error.message}</p>
            ) : null}
            <Button type="submit" disabled={!code || signIn.isPending}>
              {signIn.isPending ? 'Checking…' : 'Enter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
