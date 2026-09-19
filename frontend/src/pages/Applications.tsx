import { useState, useEffect } from 'react'
import { Search, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { HealthDot } from '@/components/shared/HealthDot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Application } from '@/lib/api'
import { formatNumber, relativeTime } from '@/lib/utils'
import { listApplications, createApplication } from '@/lib/api'

export default function Applications() {
  const [query, setQuery] = useState('')
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    loadApplications()
  }, [])

  async function loadApplications() {
    try {
      const data = await listApplications()
      setApps(data)
    } catch (e) {
      console.error('Failed to load applications', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      await createApplication(newName.trim())
      setNewName('')
      setDialogOpen(false)
      loadApplications()
    } catch (e) {
      console.error('Failed to create application', e)
    }
  }

  const rows = apps.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Every application reporting logs into LogPulse."
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Register Application</Button>}
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
                <TableHead>Owner</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No applications found.</TableCell></TableRow>
              ) : (
                rows.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer">
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><StatusBadge status="running" /></TableCell>
                    <TableCell className="text-muted-foreground">User {a.owner_id}</TableCell>
                    <TableCell className="text-muted-foreground">{relativeTime(a.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register Application</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Application Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. payment-service" />
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