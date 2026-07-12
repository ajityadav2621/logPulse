import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { HealthDot } from '@/components/shared/HealthDot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { APPLICATIONS } from '@/lib/mock-data'
import { formatNumber, relativeTime } from '@/lib/utils'

export default function Applications() {
  const [query, setQuery] = useState('')
  const rows = APPLICATIONS.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Every application reporting logs into LogPulse."
        actions={<Button><Plus className="h-4 w-4" /> Register Application</Button>}
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search applications..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Servers</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Last Deployment</TableHead>
                <TableHead>Log Count</TableHead>
                <TableHead>Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} className="cursor-pointer">
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell><span className="capitalize text-muted-foreground">{a.environment}</span></TableCell>
                  <TableCell className="text-muted-foreground">{a.owner}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{a.serverCount}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{a.version}</TableCell>
                  <TableCell className="text-muted-foreground">{relativeTime(a.lastDeployment)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{formatNumber(a.logCount)}</TableCell>
                  <TableCell><HealthDot status={a.health} pulse={a.health !== 'green'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}