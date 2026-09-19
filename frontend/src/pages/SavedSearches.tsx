import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Play, Trash2, Share2, Plus } from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SavedSearch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { listSavedSearches, createSavedSearch, deleteSavedSearch } from '@/lib/api'

export default function SavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFilters, setNewFilters] = useState('')

  useEffect(() => {
    loadSearches()
  }, [])

  async function loadSearches() {
    try {
      const data = await listSavedSearches()
      setSearches(data)
    } catch (e) {
      console.error('Failed to load saved searches', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      await createSavedSearch(newName.trim(), newFilters.trim())
      setNewName('')
      setNewFilters('')
      setDialogOpen(false)
      loadSearches()
    } catch (e) {
      console.error('Failed to create saved search', e)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSavedSearch(id)
      setSearches((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      console.error('Failed to delete saved search', e)
    }
  }

  return (
    <div>
      <PageHeader
        title="Saved Searches"
        description="Reusable queries shared across your team."
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Saved Search</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Filters</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : searches.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No saved searches found.</TableCell></TableRow>
              ) : (
                searches.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="max-w-sm truncate font-mono text-xs text-muted-foreground">{s.filters}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate('/logs')}>
                        <Play className="h-4 w-4" /> Run
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
          <DialogHeader><DialogTitle>New Saved Search</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Production errors" />
            </div>
            <div className="space-y-1.5">
              <Label>Filters (JSON)</Label>
              <Input value={newFilters} onChange={(e) => setNewFilters(e.target.value)} placeholder='{"app":"payment","level":"error"}' />
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