import { AppError } from '@/lib/result'

export function ErrorNote({ error }: { error: Error }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
      {error instanceof AppError && error.traceId ? (
        <span className="block text-muted-foreground">Railway trace ID: {error.traceId}</span>
      ) : null}
    </p>
  )
}
