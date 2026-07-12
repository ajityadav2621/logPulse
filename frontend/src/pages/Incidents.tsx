import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Button as Btn } from '@/components/ui/button'
import { INCIDENTS, type Incident } from '@/lib/mock-data'
import { relativeTime } from '@/lib/utils'

const SEV_VARIANT: Record<Incident['severity'], 'critical' | 'error' | 'warning' | 'info'> = {
  sev1: 'critical',
  sev2: 'error',
  sev3: 'warning',
  sev4: 'info',
}

export default function Incidents() {
  const [selected, setSelected] = useState<Incident | null>(null)

  return (
    <div>
      <PageHeader
        title="Incident Management"
        description="Track, assign, and resolve production incidents."
        actions={<Button><Plus className="h-4 w-4" /> Declare Incident</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Resolved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INCIDENTS.map((inc) => (
                <TableRow key={inc.id} className="cursor-pointer" onClick={() => setSelected(inc)}>
                  <TableCell>
                    <p className="font-medium">{inc.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{inc.id}</p>
                  </TableCell>
                  <TableCell><Badge variant={SEV_VARIANT[inc.severity]} className="uppercase">{inc.severity}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{inc.assignedTo}</TableCell>
                  <TableCell><StatusBadge status={inc.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{relativeTime(inc.created)}</TableCell>
                  <TableCell className="text-muted-foreground">{inc.resolved ? relativeTime(inc.resolved) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={SEV_VARIANT[selected.severity]} className="uppercase">{selected.severity}</Badge>
                  <StatusBadge status={selected.status} />
                  <span className="text-muted-foreground">Assigned to {selected.assignedTo}</span>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Timeline</p>
                  <ul className="space-y-2 border-l border-border pl-4">
                    <li className="relative text-muted-foreground">
                      <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-level-error" />
                      Incident declared — {relativeTime(selected.created)}
                    </li>
                    <li className="relative text-muted-foreground">
                      <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-level-warning" />
                      Root cause under investigation
                    </li>
                    {selected.resolved && (
                      <li className="relative text-muted-foreground">
                        <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-primary" />
                        Resolved — {relativeTime(selected.resolved)}
                      </li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Related Logs</p>
                  <p className="text-muted-foreground">3 related log clusters flagged from the Log Explorer.</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Comments</p>
                  <Textarea placeholder="Add an update for the team..." className="mb-2" />
                  <Btn size="sm">Post comment</Btn>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}