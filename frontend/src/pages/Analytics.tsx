import { PageHeader } from '@/components/shared/PageHeader'
import { ChartCard } from '@/components/ui/charts/ChartCard'
import { BarComparisonChart } from '@/components/ui/charts/BarComparisonChart'
import { TrendLineChart } from '@/components/ui/charts/TrendLineChart'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Percent, Timer, Activity, Users2 } from 'lucide-react'
import {
  getTopErrorTypes,
  getTopApis,
  getSlowApis,
  getDailyTrend,
  getRequestsPerMinute,
  getPeakHours,
  getTopApplications,
  getTopServers,
} from '@/lib/mock-data'
import { formatNumber } from '@/lib/utils'

export default function Analytics() {
  const topApps = getTopApplications()
  const topServers = getTopServers()

  return (
    <div>
      <PageHeader title="Analytics" description="Deeper trends across errors, traffic, and usage." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Error Rate" value="2.4%" icon={<Percent className="h-4.5 w-4.5" />} tone="error" hint="last 24h" />
        <StatCard label="Avg Response Time" value="184ms" icon={<Timer className="h-4.5 w-4.5" />} tone="info" hint="last 24h" />
        <StatCard label="Requests" value={formatNumber(1284000)} icon={<Activity className="h-4.5 w-4.5" />} tone="primary" hint="last 24h" />
        <StatCard label="Active Sessions" value={formatNumber(4821)} icon={<Users2 className="h-4.5 w-4.5" />} tone="default" hint="right now" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Most Frequent Errors">
          <BarComparisonChart data={getTopErrorTypes()} dataKey="count" nameKey="name" horizontal color="hsl(var(--level-error))" />
        </ChartCard>
        <ChartCard title="Top APIs by Requests">
          <BarComparisonChart data={getTopApis()} dataKey="requests" nameKey="name" horizontal color="hsl(var(--level-info))" />
        </ChartCard>
        <ChartCard title="Slowest APIs">
          <BarComparisonChart data={getSlowApis()} dataKey="avgMs" nameKey="name" horizontal color="hsl(var(--level-warning))" />
        </ChartCard>
        <ChartCard title="Traffic (Requests / min)">
          <TrendLineChart data={getRequestsPerMinute()} xKey="t" series={[{ key: 'requests', color: 'hsl(var(--primary))', label: 'Requests' }]} />
        </ChartCard>
        <ChartCard title="Error Rate Over Time">
          <TrendLineChart data={getDailyTrend(14)} xKey="date" series={[{ key: 'errors', color: 'hsl(var(--level-error))', label: 'Errors' }]} />
        </ChartCard>
        <ChartCard title="Peak Hours (Sessions)">
          <BarComparisonChart
            data={getPeakHours().map((p) => ({ name: `${p.hour}:00`, sessions: p.sessions }))}
            dataKey="sessions"
            color="hsl(var(--level-debug))"
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most Active Application</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{topApps[0]?.name}</p>
            <p className="text-sm text-muted-foreground">{formatNumber(topApps[0]?.logs ?? 0)} logs in the last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Most Active Server</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{topServers[0]?.name}</p>
            <p className="text-sm text-muted-foreground">{formatNumber(topServers[0]?.logs ?? 0)} logs in the last 24 hours</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}