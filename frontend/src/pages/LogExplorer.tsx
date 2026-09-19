import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, MoreHorizontal, Eye, Download, Copy, Bookmark, Trash2, Share2, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import type { LogLevel } from '@/lib/types'
import type { LogEntry } from '@/lib/api'
import { fetchLogs } from '@/lib/api'
import { relativeTime } from '@/lib/utils'

const PAGE_SIZE = 12
const LEVELS: LogLevel[] = ['critical', 'error', 'warning', 'info', 'debug']

export default function LogExplorer() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [level, setLevel] = useState<string>('all')
  const [app, setApp] = useState<string>('all')
  const [searchMode, setSearchMode] = useState('contains')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<string[]>([])

  useEffect(() => {
    loadLogs()
  }, [])

  // React to searches started elsewhere (e.g. the topbar) via /logs?q=...
  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null && q !== query) {
      setQuery(q)
      loadLogs({ q })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function loadLogs(overrides?: { q?: string; level?: string; app?: string }) {
    setLoading(true)
    try {
      const q = overrides?.q ?? query
      const lv = overrides?.level ?? level
      const ap = overrides?.app ?? app
      const params: Record<string, string> = {}
      if (lv !== 'all') params.level = lv
      if (ap !== 'all') params.app = ap
      if (q) params.q = q
      const data = await fetchLogs(params)
      setLogs(data)
      setApps(Array.from(new Set(data.map((l) => l.app_name))))
    } catch (e) {
      console.error('Failed to load logs', e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (level !== 'all' && l.level !== level) return false
      if (app !== 'all' && l.app_name !== app) return false
      if (query && !l.message.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [logs, level, app, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Log Explorer"
        description={`${filtered.length.toLocaleString()} logs match your current filters`}
      />

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs... e.g. status_code:500 AND application:payments-api"
                className="pl-8 font-mono text-sm"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Button variant="outline" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
            <Button onClick={() => loadLogs()}>Search</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={searchMode} onValueChange={setSearchMode}>
              <TabsList>
                <TabsTrigger value="contains">Contains</TabsTrigger>
                <TabsTrigger value="starts">Starts With</TabsTrigger>
                <TabsTrigger value="ends">Ends With</TabsTrigger>
                <TabsTrigger value="exact">Exact Match</TabsTrigger>
                <TabsTrigger value="regex">Regex</TabsTrigger>
                <TabsTrigger value="boolean">Boolean</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="ml-auto flex items-center gap-2">
              <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1) }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Log Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={app} onValueChange={(v) => { setApp(v); setPage(1) }}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Application" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All applications</SelectItem>
                  {apps.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No logs found.</TableCell></TableRow>
              ) : (
                pageRows.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer" onClick={() => navigate(`/logs/${log.id}`, { state: log })}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {relativeTime(log.timestamp)}
                    </TableCell>
                    <TableCell><LevelBadge level={log.level as LogLevel} /></TableCell>
                    <TableCell className="font-medium">{log.app_name}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RowActions logId={String(log.id)} onView={() => navigate(`/logs/${log.id}`, { state: log })} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <FiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} />
    </div>
  )
}

function RowActions({ onView }: { logId: string; onView: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
        <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
        <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Copy</DropdownMenuItem>
        <DropdownMenuItem><Bookmark className="mr-2 h-4 w-4" /> Bookmark</DropdownMenuItem>
        <DropdownMenuItem><Share2 className="mr-2 h-4 w-4" /> Share</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FiltersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const fields = [
    'Date', 'Time', 'Server', 'Host', 'Module', 'Status Code', 'Request ID', 'Trace ID', 'Session ID', 'User ID', 'API Endpoint', 'Tags',
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Advanced filters</SheetTitle>
        </SheetHeader>
        <div className="scrollbar-thin mt-4 grid max-h-[calc(100vh-8rem)] grid-cols-1 gap-3 overflow-y-auto pr-1">
          {fields.map((f) => (
            <div key={f} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{f}</label>
              <Input placeholder={`Filter by ${f.toLowerCase()}`} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1">Apply filters</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}