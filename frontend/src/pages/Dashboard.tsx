import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  AppWindow,
  BellOff,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/ui/charts/ChartCard'
import { TrendLineChart } from '@/components/ui/charts/TrendLineChart'
import { LevelPieChart } from '@/components/ui/charts/LevelPieChart'
import { BarComparisonChart } from '@/components/ui/charts/BarComparisonChart'
import { EmptyState } from '@/components/shared/EmptyState'
import { useLogStream } from '@/hooks/useLogStream'
import {
  fetchAnomalies,
  fetchLevelCounts,
  fetchOverview,
  fetchTimeseries,
  fetchTopApps,
  listIncidents,
  type AnomalyResult,
  type Incident,
  type StatsOverview,
  type TimeseriesPoint,
  type TopApp,
} from '@/lib/api'
import { formatNumber, relativeTime } from '@/lib/utils'

const REFRESH_MS = 30_000

const LEVEL_COLORS: Record<string, string> = {
  critical: 'hsl(var(--level-critical))',
  error: 'hsl(var(--level-error))',
  warning: 'hsl(var(--level-warning))',
  info: 'hsl(var(--level-info))',
  debug: 'hsl(var(--level-debug))',
}

function ErrorRateDelta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return null
  const diff = now - prev
  const up = diff >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${up ? 'text-level-error' : 'text-primary'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}
      {(diff * 100).toFixed(1)} pts vs yesterday
    </span>
  )
}

const SOURCE_LABEL: Record<string, string> = {
  anomaly: 'Auto · anomaly',
  correlation: 'Auto · correlated',
  alert: 'Auto · alert',
  manual: 'Declared',
}

export default function Dashboard() {
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [series, setSeries] = useState<TimeseriesPoint[]>([])
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [topApps, setTopApps] = useState<TopApp[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([])
  const [loading, setLoading] = useState(true)
  const { liveLogs, connected } = useLogStream()

  const load = useCallback(async () => {
    try {
      const [ov, ts, lv, apps, incs, anoms] = await Promise.all([
        fetchOverview(),
        fetchTimeseries({ hours: 48, bucket: 'hour' }),
        fetchLevelCounts(24),
        fetchTopApps(24),
        listIncidents(),
        fetchAnomalies(),
      ])
      setOverview(ov)
      setSeries(ts)
      setLevels(lv)
      setTopApps(apps)
      setIncidents(incs.slice(0, 5))
      setAnomalies(anoms.results.slice(0, 4))
    } catch (e) {
      console.error('Failed to load dashboard data', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  const pieData = Object.entries(levels)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, color: LEVEL_COLORS[k] ?? 'hsl(var(--muted-foreground))' }))
    .sort((a, b) => b.value - a.value)

  const chartData = series.map((p) => ({
    bucket: new Date(p.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    total: p.total,
    errors: p.error + p.critical,
  }))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Real-time health, anomalies, and incidents across every application sending logs."
        actions={
          <span className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${connected ? 'border-primary/30 bg-primary/10 text-primary' : 'border-level-error/30 bg-level-error/10 text-level-error'}`}>
            <Activity className="h-3.5 w-3.5" />
            {connected ? 'Live stream connected' : 'Stream offline'}
          </span>
        }
      />

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {loading || !overview ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)
        ) : (
          <>
            <StatCard
              label="Logs (24h)"
              value={formatNumber(overview.logs_24h)}
              hint={`${overview.logs_per_min.toFixed(1)}/min right now`}
              icon={<Activity className="h-4 w-4" />}
              tone="primary"
            />
            <StatCard
              label="Error rate (24h)"
              value={`${(overview.error_rate_24h * 100).toFixed(1)}%`}
              hint={<ErrorRateDelta now={overview.error_rate_24h} prev={overview.error_rate_prev_24h} />}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="error"
            />
            <StatCard
              label="Active apps"
              value={overview.active_apps}
              hint="sending logs in the last 24h"
              icon={<AppWindow className="h-4 w-4" />}
              tone="info"
            />
            <StatCard
              label="Open incidents"
              value={overview.open_incidents}
              hint={overview.open_anomalies > 0 ? `${overview.open_anomalies} from auto-detection` : 'no active anomalies'}
              icon={<ShieldAlert className="h-4 w-4" />}
              tone={overview.open_incidents > 0 ? 'critical' : 'default'}
            />
            <StatCard
              label="Alerts triaged (1h)"
              value={overview.suppressed_alerts_1h}
              hint="duplicate pages suppressed"
              icon={<BellOff className="h-4 w-4" />}
              tone="warning"
            />
          </>
        )}
      </div>

      {/* Volume + level mix */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Log volume — last 48h" className="xl:col-span-2" height={260}>
          {chartData.some((d) => d.total > 0) ? (
            <TrendLineChart
              data={chartData}
              xKey="bucket"
              series={[
                { key: 'total', color: 'hsl(var(--primary))', label: 'All logs' },
                { key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' },
              ]}
            />
          ) : (
            <EmptyState
              title="No log data yet"
              description="Send a log via POST /api/logs or the SDK — this chart fills in as data arrives."
              className="h-full border-0"
            />
          )}
        </ChartCard>

        <ChartCard title="Level mix (24h)" height={260}>
          {pieData.length > 0 ? (
            <LevelPieChart data={pieData} />
          ) : (
            <EmptyState title="Nothing ingested yet" className="h-full border-0" />
          )}
        </ChartCard>
      </div>

      {/* Top apps + incidents + anomalies */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Busiest apps (24h)" height={240}>
          {topApps.length > 0 ? (
            <BarComparisonChart
              data={topApps.map((a) => ({ name: a.app_name, logs: a.total }))}
              horizontal
              dataKey="logs"
              nameKey="name"
            />
          ) : (
            <EmptyState title="No apps yet" className="h-full border-0" />
          )}
        </ChartCard>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Open incidents</CardTitle>
            <Link to="/incidents" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {incidents.length === 0 ? (
              <EmptyState
                title="No open incidents"
                description="Anomaly detection and alert correlation open incidents automatically; you can also declare one manually."
                className="border-0 py-8"
              />
            ) : (
              incidents.map((inc) => (
                <Link
                  key={inc.id}
                  to="/incidents"
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-accent"
                >
                  <LevelBadge level={inc.severity as any} className="px-1.5 py-0 text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inc.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{inc.summary}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {SOURCE_LABEL[inc.source] ?? inc.source}
                    </Badge>
                    <StatusBadge status={inc.status} className="text-[10px]" />
                    <span className="hidden w-16 text-right text-[11px] text-muted-foreground sm:block">
                      {relativeTime(inc.started_at)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live anomalies + live feed */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Live anomaly sweep</CardTitle>
            <Link to="/analytics" className="text-xs font-medium text-primary hover:underline">
              Analytics →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All applications are within their learned baseline.
              </p>
            ) : (
              anomalies.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border/60 p-2.5">
                  <LevelBadge level={a.severity as any} className="mt-0.5 px-1.5 py-0 text-[10px]" />
                  <div className="min-w-0">
                    <p className="text-sm">{a.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      z={a.score.toFixed(1)} ·{' '}
                      {a.kind === 'error_rate'
                        ? `observed ${(a.observed * 100).toFixed(1)}% vs baseline ${(a.expected * 100).toFixed(1)}%`
                        : `observed ${a.observed} vs expected ${a.expected}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Live feed</CardTitle>
            <Link to="/live-logs" className="text-xs font-medium text-primary hover:underline">
              Full stream →
            </Link>
          </CardHeader>
          <CardContent className="scrollbar-thin max-h-[220px] space-y-1 overflow-y-auto font-mono text-xs">
            {liveLogs.length === 0 ? (
              <p className="py-6 text-center font-sans text-sm text-muted-foreground">Waiting for incoming logs…</p>
            ) : (
              liveLogs.slice(0, 8).map((log, i) => (
                <div key={`${log.timestamp}-${i}`} className="flex items-center gap-2 truncate">
                  <span className="shrink-0 text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span
                    className={`w-14 shrink-0 text-[10px] font-semibold uppercase ${
                      log.level === 'error' || log.level === 'critical' ? 'text-level-error' : log.level === 'warn' || log.level === 'warning' ? 'text-level-warning' : 'text-primary'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="truncate">
                    <span className="text-muted-foreground">{log.app_name}:</span> {log.message}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
