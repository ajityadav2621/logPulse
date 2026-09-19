import { useCallback, useEffect, useState } from 'react'
import { Copy, Layers, LineChart as LineChartIcon, Sparkles, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/ui/charts/ChartCard'
import { TrendLineChart } from '@/components/ui/charts/TrendLineChart'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  fetchAnomalies,
  fetchClusters,
  fetchForecast,
  fetchTimeseries,
  listApplications,
  type AnomalyResult,
  type Forecast,
  type LogCluster,
  type TimeseriesPoint,
} from '@/lib/api'
import { formatNumber, relativeTime } from '@/lib/utils'

function ChartEmpty() {
  return <EmptyState title="No data in this window" className="h-full border-0" />
}

export default function Analytics() {
  const [hours, setHours] = useState('48')
  const [bucket, setBucket] = useState('hour')
  const [app, setApp] = useState('all')
  const [apps, setApps] = useState<{ id: number; name: string }[]>([])

  const [series, setSeries] = useState<TimeseriesPoint[]>([])
  const [clusters, setClusters] = useState<LogCluster[]>([])
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listApplications().then((as) => setApps(as.map((a) => ({ id: a.id, name: a.name })))).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const appParam = app === 'all' ? undefined : app
      const [ts, cl] = await Promise.all([
        fetchTimeseries({ hours: Number(hours), bucket, app: appParam }),
        fetchClusters({ hours: Number(hours), app: appParam, min_count: 2, limit: 30 }),
      ])
      setSeries(ts)
      setClusters(cl)
    } catch (e) {
      console.error('Failed to load analytics', e)
    } finally {
      setLoading(false)
    }
  }, [hours, bucket, app])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchForecast(app === 'all' ? undefined : app).then(setForecast).catch(() => {})
    fetchAnomalies().then((a) => setAnomalies(a.results)).catch(() => {})
  }, [app])

  const chartData = series.map((p) => ({
    bucket: new Date(p.bucket).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: bucket === 'minute' ? '2-digit' : undefined,
    }),
    total: p.total,
    errors: p.error + p.critical,
    error_rate: +(p.error_rate * 100).toFixed(2),
  }))

  const forecastData = forecast?.points?.map((p) => ({
    bucket: new Date(p.bucket).toLocaleTimeString([], { hour: '2-digit' }),
    predicted: p.predicted,
    band: [p.lower, p.upper] as [number, number],
  }))

  const dedupLines = clusters.reduce((acc, c) => acc + c.count, 0)
  const dedupSaved = clusters.reduce((acc, c) => acc + Math.max(0, c.count - 1), 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description="Trends, deduplicated failure patterns, volume forecasts, and anomaly sweeps."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={app} onValueChange={setApp}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Application" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All applications</SelectItem>
                {apps.map((a) => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Last 6h</SelectItem>
                <SelectItem value="24">Last 24h</SelectItem>
                <SelectItem value="48">Last 48h</SelectItem>
                <SelectItem value="168">Last 7d</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bucket} onValueChange={setBucket}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minute">Minute</SelectItem>
                <SelectItem value="hour">Hour</SelectItem>
                <SelectItem value="day">Day</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </div>
        }
      />

      {/* Volume + error rate */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Log volume" height={260} action={<LineChartIcon className="h-4 w-4 text-muted-foreground" />}>
          {loading ? <Skeleton className="h-full w-full rounded-md" /> : chartData.some((d) => d.total > 0) ? (
            <TrendLineChart
              data={chartData}
              xKey="bucket"
              series={[
                { key: 'total', color: 'hsl(var(--primary))', label: 'All logs' },
                { key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' },
              ]}
            />
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>

        <ChartCard title="Error rate (%)" height={260}>
          {loading ? <Skeleton className="h-full w-full rounded-md" /> : chartData.some((d) => d.total > 0) ? (
            <TrendLineChart
              data={chartData}
              xKey="bucket"
              series={[{ key: 'error_rate', color: 'hsl(var(--level-warning))', label: 'Error rate %' }]}
            />
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>
      </div>

      {/* Clustering / dedup (AI-1) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">Failure signatures</CardTitle>
            <Badge variant="outline">AI-1 clustering</Badge>
          </div>
          {clusters.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatNumber(dedupLines)} log lines collapsed into {clusters.length} patterns — {formatNumber(dedupSaved)} duplicates hidden
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {clusters.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="No repeated patterns in this window"
              description="Near-duplicate log lines (same message, different IDs/timestamps) group here with a live count."
              className="m-4 border-0"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Count</TableHead>
                  <TableHead>Pattern (variables normalized)</TableHead>
                  <TableHead className="w-24">Level</TableHead>
                  <TableHead className="w-44">Apps</TableHead>
                  <TableHead className="w-24">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clusters.map((c) => (
                  <TableRow key={c.pattern_hash}>
                    <TableCell>
                      <Badge variant={c.count >= 100 ? 'destructive' : c.count >= 10 ? 'warning' : 'secondary'} className="tabular">
                        ×{formatNumber(c.count)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <p className="truncate font-mono text-xs" title={c.pattern}>{c.pattern}</p>
                      <p className="truncate text-[11px] text-muted-foreground" title={c.sample_message}>
                        e.g. {c.sample_message}
                      </p>
                    </TableCell>
                    <TableCell><LevelBadge level={c.level as any} className="px-1.5 py-0 text-[10px]" /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.apps.slice(0, 2).map((a) => (
                          <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                        ))}
                        {c.apps.length > 2 && <Badge variant="outline" className="text-[10px]">+{c.apps.length - 2}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{relativeTime(c.last_seen)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Forecast (AI-7) + anomalies (AI-2) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Volume forecast — next 24h"
          height={280}
          action={<Badge variant="outline">AI-7</Badge>}
        >
          {!forecast || (forecast.points ?? []).length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6" />}
              title={forecast?.note ?? 'Forecast needs more history'}
              description="Once an app has 24+ hours of logs, the model projects the next day with a confidence band."
              className="h-full border-0"
            />
          ) : (
            <div className="flex h-full flex-col gap-2">
              <div className="flex-1">
                <TrendLineChart
                  data={[
                    ...forecast.baseline.slice(-24).map((b) => ({
                      bucket: new Date(b.bucket).toLocaleTimeString([], { hour: '2-digit' }),
                      predicted: b.total,
                    })),
                    ...forecastData!,
                  ]}
                  xKey="bucket"
                  series={[{ key: 'predicted', color: 'hsl(var(--level-info))', label: 'Logs/hour (history → forecast)' }]}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <Badge variant="secondary">now {formatNumber(Math.round(forecast.current_daily))}/day</Badge>
                <Badge variant="secondary">forecast {formatNumber(Math.round(forecast.predicted_daily))}/day</Badge>
                <Badge variant={forecast.growth_per_day > 20 ? 'destructive' : 'outline'}>
                  {forecast.growth_per_day >= 0 ? '+' : ''}{forecast.growth_per_day}%/day
                </Badge>
                <Badge variant="outline">~{forecast.storage_30d_gb} GB / 30d</Badge>
              </div>
            </div>
          )}
        </ChartCard>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">Anomaly sweep</CardTitle>
              <Badge variant="outline">AI-2</Badge>
            </div>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.length === 0 ? (
              <EmptyState
                title="Everything within baseline"
                description="Each app's 7-day volume and error-rate baseline is compared against the current 15-minute window (z ≥ 3 flags)."
                className="border-0 py-8"
              />
            ) : (
              anomalies.map((a, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">{a.kind.replace('_', ' ')}</Badge>
                    <span className="text-sm font-medium">{a.app_name}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">z={a.score.toFixed(1)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                </div>
              ))
            )}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Auto-detected findings are persisted as incidents (correlated across services when they co-occur) — check the
              <a href="/incidents" className="mx-1 text-primary hover:underline">Incidents</a> page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
