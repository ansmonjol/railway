import { Loader2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Status } from '@/server/snapshot'

// `pending` is client-side only: a call for this instance is still in flight.
export type BadgeStatus = Status | 'pending'

const LABELS: Record<BadgeStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  sleeping: 'Sleeping',
  stopping: 'Stopping',
  stopped: 'Stopped',
  failed: 'Failed',
  destroying: 'Destroying',
  unknown: 'Unknown',
  pending: 'Pending',
}

const DOTS: Record<Status, string> = {
  starting: 'bg-amber-500 motion-safe:animate-pulse',
  stopping: 'bg-amber-500 motion-safe:animate-pulse',
  running: 'bg-emerald-500',
  sleeping: 'bg-sky-500',
  stopped: 'bg-zinc-400',
  failed: 'bg-red-500',
  destroying: 'bg-red-500 motion-safe:animate-pulse',
  unknown: 'border border-zinc-400',
}

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      {status === 'pending' ? (
        <Loader2Icon aria-hidden className="size-3 motion-safe:animate-spin" />
      ) : (
        <span aria-hidden className={cn('size-2 rounded-full', DOTS[status])} />
      )}
      {LABELS[status]}
    </Badge>
  )
}
