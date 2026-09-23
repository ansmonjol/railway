import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/StatusBadge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { destroy, restart, start, stop } from '@/functions'
import { noteWrite, snapshotQuery } from '@/lib/queries'
import { unwrap } from '@/lib/result'
import { timeAgo } from '@/lib/utils'
import type { Action, Instance } from '@/server/snapshot'

const VERBS = { start, stop, restart, destroy }
const LABELS: Record<Action, string> = {
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
  destroy: 'Destroy',
}

export function InstanceRow({ instance }: { instance: Instance }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const action = useMutation({
    mutationFn: (verb: Action) => VERBS[verb]({ data: { serviceId: instance.id } }).then(unwrap),
    onSuccess: (_, verb) => {
      if (verb === 'destroy') toast.success(`Destroyed ${instance.name}`)
    },
    // Stay pending until the list shows the effect of the call. A failed call may
    // still have reached Railway (a timeout), so both outcomes refresh the list.
    onSettled: () => {
      noteWrite()
      return queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey })
    },
  })
  const buttons = instance.actions.filter((verb) => verb !== 'destroy')
  const spunAt = instance.spinnedAt ?? instance.createdAt

  return (
    <TableRow>
      <TableCell>
        <StatusBadge status={action.isPending ? 'pending' : instance.status} />
      </TableCell>
      <TableCell className="max-w-0 truncate">
        <Link
          to="/instances"
          search={{ instance: instance.id }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {instance.name}
        </Link>
        {instance.url ? (
          <a
            href={instance.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-muted-foreground hover:text-foreground"
          >
            {instance.url.replace('https://', '')}
          </a>
        ) : null}
      </TableCell>
      <TableCell className="hidden sm:table-cell">{instance.spinnedBy ?? 'Unknown'}</TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        <time dateTime={spunAt} title={new Date(spunAt).toLocaleString()}>
          {timeAgo(spunAt)}
        </time>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {buttons.map((verb) => (
            <Button
              key={verb}
              size="sm"
              variant="outline"
              disabled={action.isPending}
              onClick={() => action.mutate(verb)}
            >
              {LABELS[verb]}
            </Button>
          ))}
          {instance.actions.includes('destroy') ? (
            <AlertDialog open={confirming} onOpenChange={setConfirming}>
              <AlertDialogTrigger
                render={<Button size="sm" variant="ghost" className="text-destructive" />}
                disabled={action.isPending}
              >
                Destroy
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Destroy {instance.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes the service and its public URL on Railway. It can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      setConfirming(false)
                      action.mutate('destroy')
                    }}
                  >
                    Destroy
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}
