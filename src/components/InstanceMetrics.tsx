import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ErrorNote } from '@/components/ErrorNote'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { metricsQuery } from '@/lib/queries'
import type { Instance } from '@/server/snapshot'

// Two small charts on the same one-hour axis instead of one chart with two
// y-scales: vCPU and MB have nothing in common but time.
const SERIES_COLOR = '#2a78d6'
const clock = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false })
// Significant digits, not decimals: whoami idles around 0.001 vCPU.
const number = new Intl.NumberFormat('en', { maximumSignificantDigits: 2 })
const format = (value: number) => number.format(value)

type Point = { ts: number; value: number }

export function InstanceMetrics({ instance }: { instance: Instance }) {
  const { data, error, isPending } = useQuery(metricsQuery(instance.id))
  if (isPending) return <Skeleton className="h-72 w-full" />
  if (error) return <ErrorNote error={error} />
  if (data.cpu.length === 0 && data.memoryMb.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No metrics for the last hour yet. Railway samples a running instance once a minute.
      </p>
    )
  }
  const domain: [number, number] = [data.from, data.to]
  return (
    <div className="grid gap-6">
      <MetricChart title="CPU" unit="vCPU" points={data.cpu} domain={domain} />
      <MetricChart title="Memory" unit="MB" points={data.memoryMb} domain={domain} />
    </div>
  )
}

function MetricChart(props: {
  title: string
  unit: string
  points: Point[]
  domain: [number, number]
}) {
  const { title, unit, points, domain } = props
  const latest = points.at(-1)
  const config = {
    value: { label: `${title} (${unit})`, color: SERIES_COLOR },
  } satisfies ChartConfig

  return (
    <figure className="grid gap-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          {title} <span className="font-normal text-muted-foreground">({unit})</span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {latest ? `${format(latest.value)} ${unit} now` : 'No data'}
        </span>
      </figcaption>
      <ChartContainer config={config} className="aspect-auto h-32 w-full">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={domain}
            tickFormatter={(ts: number) => clock.format(ts)}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
          />
          <YAxis
            width={56}
            tickCount={3}
            tickLine={false}
            axisLine={false}
            tickFormatter={format}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) => {
                  const point = payload[0]?.payload as Point | undefined
                  return point ? clock.format(point.ts) : null
                }}
              />
            }
          />
          <Area
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill="var(--color-value)"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </figure>
  )
}
