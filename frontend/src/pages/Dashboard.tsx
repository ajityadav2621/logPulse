import { useEffect, useState } from 'react'
import {
  ScrollText,
  CalendarClock,
  Flame,
  AlertTriangle,
  Info,
  Bug,
  Siren,
  Server,
  AppWindow,
  Users,
  BellRing,
  HardDrive,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { HealthDot } from '@/components/shared/HealthDot'
import { ChartCard } from '@/components/ui/charts/ChartCard'
import { LevelPieChart } from '@/components/ui/charts/LevelPieChart'
import { TrendLineChart } from '@/components/ui/charts/TrendLineChart'
import { BarComparisonChart } from '@/components/ui/charts/BarComparisonChart'
import { GaugeChart } from '@/components/ui/charts/GaugeChart'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  getSummary,
  getLogLevelDistribution,
  getHourlyTrend,
  getDailyTrend,
  getWeeklyTrend,
  getMonthlyTrend,
  getRequestsPerMinute,
  getResponseTimeSeries,
  getTopApplications,
  getTopServers,
  getTopErrorTypes,
  getStatusCodeDistribution,
  getGauges,
  SYSTEM_HEALTH,
  ALERT_HISTORY,
  generateLog,
  type LogRecord,
} from '@/lib/mock-data'
import { formatNumber, formatBytes, relativeTime } from '@/lib/utils'

export default function Dashboard() {
  const summary = getSummary()
  const gauges = getGauges()
  const [liveLogs, setLiveLogs] = useState<LogRecord[]>(() => Array.from({ length: 8 }, (_, i) => generateLog(i * 4000)))

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveLogs((prev) => [generateLog(0), ...prev].slice(0, 8))
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const cards = [
    { label: 'Total Logs', value: formatNumber(summary.totalLogs), icon: <ScrollText className="h-4.5 w-4.5" />, tone: 'default' as const },
    { label: 'Logs Today', value: formatNumber(summary.logsToday), icon: <CalendarClock className="h-4.5 w-4.5" />, tone: 'primary' as const },
    { label: 'Error Logs', value: formatNumber(summary.errorLogs), icon: <Flame className="h-4.5 w-4.5" />, tone: 'error' as const },
    { label: 'Warning Logs', value: formatNumber(summary.warningLogs), icon: <AlertTriangle className="h-4.5 w-4.5" />, tone: 'warning' as const },
    { label: 'Info Logs', value: formatNumber(summary.infoLogs), icon: <Info className="h-4.5 w-4.5" />, tone: 'info' as const },
    { label: 'Debug Logs', value: formatNumber(summary.debugLogs), icon: <Bug className="h-4.5 w-4.5" />, tone: 'debug' as const },
    { label: 'Critical Logs', value: formatNumber(summary.criticalLogs), icon: <Siren className="h-4.5 w-4.5" />, tone: 'critical' as const },
    { label: 'Active Servers', value: summary.activeServers, icon: <Server className="h-4.5 w-4.5" />, tone: 'default' as const },
    { label: 'Active Applications', value: summary.activeApplications, icon: <AppWindow className="h-4.5 w-4.5" />, tone: 'default' as const },
    { label: 'Active Users', value: formatNumber(summary.activeUsers), icon: <Users className="h-4.5 w-4.5" />, tone: 'default' as const },
    { label: 'Alerts Triggered', value: summary.alertsTriggered, icon: <BellRing className="h-4.5 w-4.5" />, tone: 'warning' as const },
    { label: 'Storage Used', value: formatBytes(summary.storageUsedGb * 1024 ** 3), icon: <HardDrive className="h-4.5 w-4.5" />, tone: 'default' as const, hint: `of ${summary.storageCapacityGb} GB` },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time overview of every application, server, and log stream." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Log Trend" className="xl:col-span-2" height={280}>
          <Tabs defaultValue="daily" className="flex h-full flex-col">
            <TabsList>
              <TabsTrigger value="hourly">Hourly</TabsTrigger>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
            <TabsContent value="hourly" className="min-h-0 flex-1">
              <TrendLineChart
                data={getHourlyTrend()}
                xKey="hour"
                series={[
                  { key: 'logs', color: 'hsl(var(--primary))', label: 'Logs' },
                  { key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' },
                ]}
              />
            </TabsContent>
            <TabsContent value="daily" className="min-h-0 flex-1">
              <TrendLineChart
                data={getDailyTrend()}
                xKey="date"
                series={[
                  { key: 'logs', color: 'hsl(var(--primary))', label: 'Logs' },
                  { key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' },
                ]}
              />
            </TabsContent>
            <TabsContent value="weekly" className="min-h-0 flex-1">
              <TrendLineChart
                data={getWeeklyTrend()}
                xKey="week"
                series={[
                  { key: 'logs', color: 'hsl(var(--primary))', label: 'Logs' },
                  { key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' },
                ]}
              />
            </TabsContent>
            <TabsContent value="monthly" className="min-h-0 flex-1">
              <TrendLineChart
                data={getMonthlyTrend()}
                xKey="month"
                series={[
                  { key: 'logs', color: 'hsl(var(--primary))', label: 'Logs' },
                  { key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' },
                ]}
              />
            </TabsContent>
          </Tabs>
        </ChartCard>

        <ChartCard title="Log Levels" height={280}>
          <LevelPieChart data={getLogLevelDistribution()} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Error Trend">
          <TrendLineChart data={getDailyTrend(10)} xKey="date" series={[{ key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' }]} />
        </ChartCard>
        <ChartCard title="Requests per Minute">
          <TrendLineChart data={getRequestsPerMinute()} xKey="t" series={[{ key: 'requests', color: 'hsl(var(--level-info))', label: 'Requests' }]} />
        </ChartCard>
        <ChartCard title="Response Time">
          <TrendLineChart
            data={getResponseTimeSeries()}
            xKey="t"
            series={[
              { key: 'p50', color: 'hsl(var(--primary))', label: 'p50' },
              { key: 'p95', color: 'hsl(var(--level-warning))', label: 'p95' },
              { key: 'p99', color: 'hsl(var(--level-error))', label: 'p99' },
            ]}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Top Applications">
          <BarComparisonChart data={getTopApplications()} dataKey="logs" color="hsl(var(--primary))" />
        </ChartCard>
        <ChartCard title="Top Servers">
          <BarComparisonChart data={getTopServers()} dataKey="logs" color="hsl(var(--level-info))" />
        </ChartCard>
        <ChartCard title="Top Error Types">
          <BarComparisonChart data={getTopErrorTypes()} dataKey="count" nameKey="name" horizontal color="hsl(var(--level-error))" />
        </ChartCard>
        <ChartCard title="API Status Codes">
          <LevelPieChart data={getStatusCodeDistribution()} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>System Resources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-around gap-4">
            <GaugeChart label="CPU Usage" value={gauges.cpu} />
            <GaugeChart label="Memory Usage" value={gauges.memory} />
            <GaugeChart label="Disk Usage" value={gauges.disk} />
            <GaugeChart label="Storage Usage" value={gauges.storage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Live Logs</CardTitle>
            <Badge variant="default" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Live
            </Badge>
          </CardHeader>
          <CardContent className="scrollbar-thin h-64 space-y-1.5 overflow-y-auto font-mono text-xs">
            {liveLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 rounded px-1.5 py-1 animate-row-in hover:bg-accent/60">
                <span className="shrink-0 text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <LevelBadge level={log.level} className="shrink-0 px-1.5 py-0 text-[10px]" />
                <span className="truncate text-foreground/90">
                  <span className="text-muted-foreground">{log.application}:</span> {log.message}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SYSTEM_HEALTH.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground/90">{s.name}</span>
                <HealthDot status={s.status} pulse={s.status !== 'green'} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Triggered</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALERT_HISTORY.slice(0, 6).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.rule}</TableCell>
                  <TableCell>
                    <LevelBadge level={a.severity} />
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{a.status}</TableCell>
                  <TableCell className="text-muted-foreground">{relativeTime(a.triggeredAt)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{a.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}