import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { deploymentsQuery, logsQuery, snapshotQuery } from '@/lib/queries'
import { AppError } from '@/lib/result'
import { cn, timeAgo } from '@/lib/utils'
import type { Instance } from '@/server/snapshot'

// Driven by ?instance=<id>, so a drawer can be linked to and survives a reload.
export function InstanceDrawer({ instanceId }: { instanceId: string | undefined }) {
  const navigate = useNavigate({ from: '/instances' })
  const { data } = useQuery(snapshotQuery)
  const instance = data?.instances.find((candidate) => candidate.id === instanceId)

  return (
    <Sheet
      open={instanceId !== undefined}
      onOpenChange={(open) => {
        if (!open) void navigate({ search: {} })
      }}
    >
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{instance?.name ?? 'Instance'}</SheetTitle>
          <SheetDescription>
            {instance
              ? (instance.url ?? 'No public URL')
              : data
                ? 'This instance does not exist anymore.'
                : 'Loading…'}
          </SheetDescription>
        </SheetHeader>
        {instance ? (
          <Tabs defaultValue="overview" className="min-h-0 flex-1 px-4 pb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="deployments">Deployments</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-2">
              <Overview instance={instance} />
            </TabsContent>
            <TabsContent value="logs" className="min-h-0 pt-2">
              <Logs instance={instance} />
            </TabsContent>
            <TabsContent value="deployments" className="pt-2">
              <Deployments instance={instance} />
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Overview({ instance }: { instance: Instance }) {
  const spunAt = instance.spinnedAt ?? instance.createdAt
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-sm">
      <Field label="Status">
        <StatusBadge status={instance.status} />
      </Field>
      <Field label="URL">
        {instance.url ? (
          <a
            href={instance.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {instance.url.replace('https://', '')}
          </a>
        ) : (
          'None'
        )}
      </Field>
      <Field label="Image">{instance.image ?? 'Unknown'}</Field>
      <Field label="Spun up by">{instance.spinnedBy ?? 'Unknown'}</Field>
      <Field label="Spun up">
        {new Date(spunAt).toLocaleString()} ({timeAgo(spunAt)})
      </Field>
      <Field label="Service ID">
        <code className="text-xs">{instance.id}</code>
      </Field>
      <Field label="Deployment ID">
        <code className="text-xs">{instance.deploymentId ?? 'None'}</code>
      </Field>
    </dl>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

function Logs({ instance }: { instance: Instance }) {
  const { data, error, isPending } = useQuery(logsQuery(instance.id))
  if (isPending) return <Skeleton className="h-64 w-full" />
  if (error) return <ErrorNote error={error} />
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {instance.deploymentId
          ? 'No logs yet.'
          : 'No deployment, so no logs. Start the instance to see some.'}
      </p>
    )
  }
  // Latest line first, so new lines never move what you are reading.
  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {data.toReversed().map((line, index) => (
        <div
          key={`${line.timestamp}-${index}`}
          className={cn(
            'break-all whitespace-pre-wrap',
            line.severity === 'error' && 'text-destructive',
          )}
        >
          <time className="text-muted-foreground" dateTime={line.timestamp}>
            {new Date(line.timestamp).toLocaleTimeString([], { hour12: false })}
          </time>{' '}
          {line.message}
        </div>
      ))}
    </div>
  )
}

function Deployments({ instance }: { instance: Instance }) {
  const { data, error, isPending } = useQuery(deploymentsQuery(instance.id))
  if (isPending) return <Skeleton className="h-40 w-full" />
  if (error) return <ErrorNote error={error} />
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No deployments yet.</p>
  return (
    <ul className="divide-y rounded-md border text-sm">
      {data.map((deployment) => (
        <li key={deployment.id} className="flex items-center justify-between gap-3 p-3">
          <StatusBadge status={deployment.status} />
          <code className="truncate text-xs text-muted-foreground">{deployment.id}</code>
          <time
            className="shrink-0 text-muted-foreground"
            dateTime={deployment.createdAt}
            title={new Date(deployment.createdAt).toLocaleString()}
          >
            {timeAgo(deployment.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  )
}

function ErrorNote({ error }: { error: Error }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
      {error instanceof AppError && error.traceId ? (
        <span className="block text-muted-foreground">Railway trace ID: {error.traceId}</span>
      ) : null}
    </p>
  )
}
