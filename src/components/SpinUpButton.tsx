import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { spinUp } from '@/functions'
import { slugify } from '@/lib/names'
import { noteWrite, snapshotQuery } from '@/lib/queries'
import { unwrap } from '@/lib/result'

// The server decides whether a slot is free; `disabled` only mirrors the last snapshot.
export function SpinUpButton({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const spin = useMutation({
    mutationFn: (name?: string) => spinUp({ data: { name } }).then(unwrap),
    onSuccess: (created) => {
      setOpen(false)
      setName('')
      toast.success(`Spinning up ${created.name}`)
    },
    onSettled: () => {
      noteWrite()
      return queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey })
    },
  })
  const slug = slugify(name)
  const label = spin.isPending ? 'Spinning up…' : 'Spin up'

  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" />} disabled={disabled || spin.isPending}>
          Custom name
        </DialogTrigger>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              spin.mutate(name)
            }}
          >
            <DialogHeader>
              <DialogTitle>Spin up with a custom name</DialogTitle>
              <DialogDescription>
                The name becomes the service name and the start of its URL.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="instance-name">Name</Label>
              <Input
                id="instance-name"
                autoFocus
                autoComplete="off"
                placeholder="my-whoami"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {slug ? `Creates ${slug}` : 'Use letters, digits or hyphens.'}
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!slug || spin.isPending}>
                {label}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Button disabled={disabled || spin.isPending} onClick={() => spin.mutate(undefined)}>
        {label}
      </Button>
    </div>
  )
}
