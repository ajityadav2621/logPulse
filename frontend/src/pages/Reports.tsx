import { CalendarDays, CalendarRange, CalendarClock, FileCog, Download, Mail } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { REPORTS } from '@/lib/mock-data'
import { relativeTime } from '@/lib/utils'

const TYPES = [
  { title: 'Daily Report', description: 'Ops summary generated every morning at 6:00 AM.', icon: CalendarDays },
  { title: 'Weekly Report', description: 'Trends and top issues across the past 7 days.', icon: CalendarRange },
  { title: 'Monthly Report', description: 'SLA compliance and volume for the month.', icon: CalendarClock },
  { title: 'Custom Report', description: 'Choose your own date range and filters.', icon: FileCog },
]

export default function Reports() {
  return (
    <div>
      <PageHeader title="Reports" description="Generate and share reporting summaries with your team." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TYPES.map((t) => (
          <Card key={t.title}>
            <CardHeader>
              <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <t.icon className="h-4.5 w-4.5" />
              </div>
              <CardTitle>{t.title}</CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="w-full">Generate</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REPORTS.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{relativeTime(r.generated)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.format}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm"><Download className="h-4 w-4" /> Download</Button>
                    <Button variant="ghost" size="sm"><Mail className="h-4 w-4" /> Email</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}