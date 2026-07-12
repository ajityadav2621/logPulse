import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Play, Trash2, Share2, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SAVED_SEARCHES } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function SavedSearches() {
  const [searches, setSearches] = useState(SAVED_SEARCHES)
  const navigate = useNavigate()

  function toggleFavorite(id: string) {
    setSearches((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s)))
  }
  function remove(id: string) {
    setSearches((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div>
      <PageHeader
        title="Saved Searches"
        description="Reusable queries shared across your team."
        actions={<Button><Plus className="h-4 w-4" /> New Saved Search</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9" />
                <TableHead>Name</TableHead>
                <TableHead>Query</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Shared</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searches.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <button onClick={() => toggleFavorite(s.id)}>
                      <Star className={cn('h-4 w-4', s.favorite ? 'fill-level-warning text-level-warning' : 'text-muted-foreground')} />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="max-w-sm truncate font-mono text-xs text-muted-foreground">{s.query}</TableCell>
                  <TableCell className="text-muted-foreground">{s.createdBy}</TableCell>
                  <TableCell>{s.shared ? <Badge variant="default">Shared</Badge> : <Badge variant="outline">Private</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/logs')}>
                      <Play className="h-4 w-4" /> Run
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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