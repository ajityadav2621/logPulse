import { useCallback, useEffect, useState } from 'react'
import { Activity, AppWindow, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { HealthDot } from '@/components/shared/HealthDot'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { type AppHealth, fetchAppHealth } from '@/lib/api'
import { formatNumber, relativeTime } from '@/lib/utils'

const STATUS_MAP = {
  healthy: { dot: 'green' as const, label: 'Healthy', cls: 'text-primary border-primary/30 bg-primary/[0.06]' },
  degraded: { dot: 'yellow' as const, label: 'Degraded', cls: 'text-level-warning border-level-warning/30 bg-level-warning/[0.06]' },
  offline: { dot: 'red' as const, label: 'Offline', cls: 'text-level-error border-level-error/30 bg-level-error/[0.06]' },
  no_data: { dot: 'yellow' as const, label: 'No data', cls: 'text-muted-foreground border-border bg-muted/40' },
}

export default function Servers() {
  const [health, setHealth] = useState<AppHealth[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setHealth(await fetchAppHealth())
    } catch (e) {
      console.error('Failed to load app health', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const counts = health.reduce<Record<string, number>>((acc, h) => {
    acc[h.status] = (acc[h.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="System Health"
        description="Per-application ingest health derived from live log flow — last seen, volume, and error rate."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['healthy', 'degraded', 'offline', 'no_data'] as const).map((s) => {
          const cfg = STATUS_MAP[s]
          return (
            <span key={s} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${cfg.cls}`}>
              <HealthDot status={cfg.dot} pulse={s === 'degraded'} />
              {counts[s] ?? 0} {cfg.label}
            </span>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : health.length === 0 ? (
        <EmptyState
          icon={<AppWindow className="h-6 w-6" />}
          title="No applications reporting yet"
          description="Register an application and send logs via POST /api/logs or one of the SDKs — health appears automatically."
          action={
            <Button onClick={() => (window.location.href = '/applications')}>Register Application</Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {health.map((h) => {
            const cfg = STATUS_MAP[h.status]
            return (
              <Card key={h.app_name} className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <HealthDot status={cfg.dot} pulse={h.status === 'healthy'} />
                    <p className="truncate font-semibold">{h.app_name}</p>
                    <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground">1h volume</p>
                      <p className="tabular text-sm font-bold">{formatNumber(h.logs_1h)}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground">1h errors</p>
                      <p className={`tabular text-sm font-bold ${h.errors_1h > 0 ? 'text-level-error' : ''}`}>{formatNumber(h.errors_1h)}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground">error rate</p>
                      <p className="tabular text-sm font-bold">{(h.error_rate_1h * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" /> {formatNumber(h.logs_24h)} logs / 24h
                    </span>
                    <span>{h.last_seen ? `last seen ${relativeTime(h.last_seen)}` : 'never seen'}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
