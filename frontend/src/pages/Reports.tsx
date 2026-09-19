import { useState, useEffect } from 'react'
import { CalendarDays, CalendarRange, CalendarClock, FileCog, Download, Mail, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Report } from '@/lib/api'
import { relativeTime } from '@/lib/utils'
import { listReports, createReport, deleteReport, exportReport } from '@/lib/api'

const TYPES = [
  { title: 'Daily Report', description: 'Ops summary generated every morning at 6:00 AM.', icon: CalendarDays },
  { title: 'Weekly Report', description: 'Trends and top issues across the past 7 days.', icon: CalendarRange },
  { title: 'Monthly Report', description: 'SLA compliance and volume for the month.', icon: CalendarClock },
  { title: 'Custom Report', description: 'Choose your own date range and filters.', icon: FileCog },
]

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'daily', format: 'csv', filters: '' })

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    try {
      const data = await listReports()
      setReports(data)
    } catch (e) {
      console.error('Failed to load reports', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    try {
      await createReport(form)
      setDialogOpen(false)
      setForm({ name: '', type: 'daily', format: 'csv', filters: '' })
      loadReports()
    } catch (e) {
      console.error('Failed to create report', e)
    }
  }

  async function handleExport(id: number) {
    try {
      const blob = await exportReport(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${id}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to export report', e)
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Generate and share reporting summaries with your team." actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Report</Button>} />

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
              <Button size="sm" className="w-full" onClick={() => setDialogOpen(true)}>Generate</Button>
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
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : reports.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No reports found.</TableCell></TableRow>
              ) : (
                reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{relativeTime(r.created_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.format}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleExport(r.id)}><Download className="h-4 w-4" /> Download</Button>
                      <Button variant="ghost" size="sm"><Mail className="h-4 w-4" /> Email</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Daily Ops Summary" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}