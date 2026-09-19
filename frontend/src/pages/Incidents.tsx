import { useCallback, useEffect, useState } from 'react'
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Eye,
  Plus,
  ShieldAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  createIncident,
  fetchIncidentAnalysis,
  listIncidents,
  updateIncident,
  type CopilotAnalysis,
  type Incident,
  type IncidentStatus,
} from '@/lib/api'
import { relativeTime } from '@/lib/utils'

const SOURCE_LABEL: Record<string, string> = {
  anomaly: 'Auto · anomaly',
  correlation: 'Auto · correlated',
  alert: 'Auto · alert',
  manual: 'Declared',
}

function parseApps(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [tab, setTab] = useState<'active' | 'resolved' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [declareOpen, setDeclareOpen] = useState(false)
  const [form, setForm] = useState({ title: '', severity: 'error', affected_apps: '', summary: '' })

  const load = useCallback(async () => {
    try {
      const data = await listIncidents(tab === 'all' ? undefined : tab)
      setIncidents(data)
    } catch (e) {
      console.error('Failed to load incidents', e)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [load])

  async function openAnalysis(inc: Incident) {
    setSelected(inc)
    setAnalysis(null)
    setAnalysisLoading(true)
    try {
      setAnalysis(await fetchIncidentAnalysis(inc.id))
    } catch (e) {
      console.error('Failed to analyze incident', e)
    } finally {
      setAnalysisLoading(false)
    }
  }

  async function setStatus(inc: Incident, status: IncidentStatus) {
    try {
      await updateIncident(inc.id, { status })
      load()
    } catch (e) {
      console.error('Failed to update incident', e)
    }
  }

  async function handleDeclare() {
    try {
      await createIncident({
        title: form.title,
        severity: form.severity,
        affected_apps: form.affected_apps,
        summary: form.summary,
      })
      setDeclareOpen(false)
      setForm({ title: '', severity: 'error', affected_apps: '', summary: '' })
      load()
    } catch (e) {
      console.error('Failed to declare incident', e)
    }
  }

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Auto-detected anomalies, correlated cross-service bursts, and manually declared incidents — each with an evidence-based root-cause analysis."
        actions={
          <Button onClick={() => setDeclareOpen(true)}>
            <Plus className="h-4 w-4" /> Declare Incident
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Active</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title={tab === 'active' ? 'No active incidents' : 'No incidents'}
          description="The background detector opens incidents when an app's volume or error rate breaks its learned baseline — and correlates bursts across services into one incident."
        />
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <Card key={inc.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <LevelBadge level={inc.severity as any} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{inc.title}</p>
                      <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[inc.source] ?? inc.source}</Badge>
                      <StatusBadge status={inc.status} className="text-[10px]" />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{inc.summary}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {(parseApps(inc.affected_apps) ?? []).map((a) => (
                        <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-[11px] text-muted-foreground md:block">
                    started {relativeTime(inc.started_at)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => openAnalysis(inc)}>
                    <BrainCircuit className="h-4 w-4" /> Analyze
                  </Button>
                  {inc.status === 'open' && (
                    <Button variant="outline" size="sm" onClick={() => setStatus(inc, 'acknowledged')}>
                      <Eye className="h-4 w-4" /> Ack
                    </Button>
                  )}
                  {inc.status !== 'resolved' && (
                    <Button variant="outline" size="sm" onClick={() => setStatus(inc, 'resolved')}>
                      <Check className="h-4 w-4" /> Resolve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Copilot analysis sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="scrollbar-thin w-full overflow-y-auto p-6 sm:max-w-2xl">
          {selected && (
            <>
              <SheetHeader className="p-0">
                <div className="flex items-center gap-2">
                  <LevelBadge level={selected.severity as any} />
                  <SheetTitle className="text-base">{selected.title}</SheetTitle>
                </div>
                <SheetDescription className="flex items-center gap-2">
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px]">{SOURCE_LABEL[selected.source] ?? selected.source}</span>
                  <span>started {relativeTime(selected.started_at)}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-5">
                {analysisLoading && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
                    <BrainCircuit className="h-4 w-4 animate-pulse" /> Analyzing logs around this incident…
                  </div>
                )}

                {analysis && (
                  <>
                    <section>
                      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                        <ChevronRight className="h-4 w-4 text-primary" /> What the data shows
                      </h3>
                      <p className="text-sm text-muted-foreground">{analysis.summary || 'No summary recorded.'}</p>
                      {(analysis.timeline ?? []).some((t) => t.total > 0) && (
                        <div className="mt-2 flex h-16 items-end gap-[3px]">
                          {analysis.timeline.map((t, i) => {
                            const max = Math.max(...analysis.timeline.map((x) => x.total), 1)
                            const errMax = Math.max(...analysis.timeline.map((x) => x.errors), 1)
                            return (
                              <div key={i} className="group relative flex-1" title={`${t.bucket}: ${t.total} logs, ${t.errors} errors`}>
                                <div
                                  className="w-full rounded-sm bg-level-info/40"
                                  style={{ height: `${Math.max(4, (t.total / max) * 60)}px` }}
                                />
                                <div
                                  className="absolute bottom-0 w-full rounded-sm bg-level-error/70"
                                  style={{ height: `${Math.max(0, (t.errors / errMax) * 60 * (t.errors / Math.max(t.total, 1)))}px` }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>

                    {(analysis.hypotheses ?? []).length > 0 && (
                      <section>
                        <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                          <BrainCircuit className="h-4 w-4 text-primary" /> Likely root causes
                          <span className="text-[11px] font-normal text-muted-foreground">(suggestions — verify before acting)</span>
                        </h3>
                        <div className="space-y-2">
                          {(analysis.hypotheses ?? []).map((h, i) => (
                            <div key={i} className="rounded-lg border border-border/60 p-3">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{h.statement}</p>
                                <Badge variant="outline" className="shrink-0 text-[10px]">{Math.round(h.confidence * 100)}%</Badge>
                              </div>
                              <Progress value={h.confidence * 100} className="mb-2 h-1" />
                              <p className="text-xs text-muted-foreground">{h.rationale}</p>
                              {(h.evidence ?? []).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {(h.evidence ?? []).map((ev, j) => (
                                    <div key={j} className="rounded bg-muted/60 p-2 font-mono text-[11px] leading-relaxed">
                                      <span className="text-muted-foreground">[{new Date(ev.timestamp).toLocaleTimeString()} {ev.app_name}]</span>{' '}
                                      {ev.message}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {(analysis.signatures ?? []).length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-sm font-semibold">Dominant failure signatures</h3>
                        <div className="space-y-1.5">
                          {(analysis.signatures ?? []).slice(0, 5).map((s) => (
                            <div key={s.pattern_hash} className="flex items-center gap-2 rounded border border-border/60 px-2.5 py-1.5">
                              <Badge variant="secondary" className="tabular text-[10px]">×{s.count}</Badge>
                              <span className="truncate font-mono text-[11px]">{s.pattern}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {(analysis.field_hints ?? []).length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-sm font-semibold">Structured-field hints</h3>
                        <div className="space-y-1">
                          {(analysis.field_hints ?? []).map((f, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              <span className="font-mono text-foreground">{f.key}</span>: {f.hint ?? Object.entries(f.values).map(([k, v]) => `${k}(${v})`).join(', ')}
                            </p>
                          ))}
                        </div>
                      </section>
                    )}

                    {(analysis.evidence ?? []).length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-sm font-semibold">Evidence — raw log lines</h3>
                        <div className="scrollbar-thin max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/40 p-2">
                          {(analysis.evidence ?? []).map((ev, i) => (
                            <div key={i} className="font-mono text-[11px] leading-relaxed">
                              <span className="text-muted-foreground">{new Date(ev.timestamp).toLocaleTimeString()}</span>{' '}
                              <span className={`font-semibold uppercase ${ev.level === 'error' || ev.level === 'critical' ? 'text-level-error' : ''}`}>{ev.level}</span>{' '}
                              <span className="text-muted-foreground">{ev.app_name}:</span> {ev.message}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <p className="text-[11px] text-muted-foreground">{analysis.note}</p>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Declare incident dialog */}
      <Dialog open={declareOpen} onOpenChange={setDeclareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declare an incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Checkout 5xx spike" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Affected apps</Label>
                <Input value={form.affected_apps} onChange={(e) => setForm({ ...form, affected_apps: e.target.value })} placeholder="api, worker" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Summary</Label>
              <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="What is happening, who noticed it, current impact…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclareOpen(false)}>Cancel</Button>
            <Button onClick={handleDeclare} disabled={!form.title}>Declare</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
