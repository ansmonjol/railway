import { useQuery } from '@tanstack/react-query'
import { InstanceRow } from '@/components/InstanceRow'
import { SpinUpButton } from '@/components/SpinUpButton'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { snapshotQuery } from '@/lib/queries'
import { AppError } from '@/lib/result'
import { cn } from '@/lib/utils'

export function InstanceList() {
  const { data, error, isPending } = useQuery(snapshotQuery)

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Instances</h1>
          <p className="text-sm text-muted-foreground">
            whoami containers in this Railway project, each with a public URL.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {data ? <SlotMeter {...data.slots} /> : null}
          <SpinUpButton disabled={!data || data.slots.free === 0} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">
          <span className="text-destructive">
            Couldn&apos;t load the instances: {error.message}
          </span>
          {error instanceof AppError && error.traceId ? (
            <span className="block text-muted-foreground">Railway trace ID: {error.traceId}</span>
          ) : null}
        </p>
      ) : null}

      <div className="rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden w-32 sm:table-cell">Spun up by</TableHead>
              <TableHead className="hidden w-36 sm:table-cell">When</TableHead>
              <TableHead className="w-56">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <LoadingRows />
            ) : data?.instances.length ? (
              data.instances.map((instance) => (
                <InstanceRow key={instance.id} instance={instance} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nothing running yet. Spin up an instance to get a whoami container with its own
                  URL.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function SlotMeter({ used, max }: { used: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, slot) => (
          <span
            key={slot}
            className={cn('h-4 w-1.5 rounded-full', slot < used ? 'bg-foreground' : 'bg-muted')}
          />
        ))}
      </div>
      {Math.min(used, max)} of {max} slots used
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 2 }, (_, row) => (
    <TableRow key={row}>
      <TableCell colSpan={5}>
        <Skeleton className="h-8 w-full" />
      </TableCell>
    </TableRow>
  ))
}
