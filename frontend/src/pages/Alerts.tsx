import { useCallback, useEffect, useState } from 'react'
import { BellOff, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertRuleView, AlertEvent, ParsedAlertDraft } from '@/lib/api'
import type { LogLevel } from '@/lib/types'
import { relativeTime } from '@/lib/utils'
import {
  createAlert,
  deleteAlert,
  listAlertEvents,
  listAlerts,
  listApplications,
  parseAlertText,
  updateAlert,
} from '@/lib/api'

const EMPTY_FORM = {
  application_id: 0,
  name: '',
  level: 'error',
  keyword: '',
  threshold: 5,
  window_seconds: 300,
  cooldown_seconds: 300,
}

export default function Alerts() {
  const [rules, setRules] = useState<AlertRuleView[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [apps, setApps] = useState<{ id: number; name: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  // NL authoring (AI-8)
  const [nlText, setNlText] = useState('')
  const [nlParsing, setNlParsing] = useState(false)
  const [nlDraft, setNlDraft] = useState<ParsedAlertDraft | null>(null)

  const load = useCallback(async () => {
    try {
      const [rs, evs, as] = await Promise.all([listAlerts(), listAlertEvents(), listApplications()])
      setRules(rs)
      setEvents(evs)
      setApps(as.map((a) => ({ id: a.id, name: a.name })))
    } catch (e) {
      console.error('Failed to load alerts', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openDialog() {
    setForm({ ...EMPTY_FORM, application_id: apps[0]?.id ?? 0 })
    setNlDraft(null)
    setDialogOpen(true)
  }

  async function parseNL() {
    if (!nlText.trim()) return
    setNlParsing(true)
    try {
      const { draft, application_id } = await parseAlertText(nlText)
      setNlDraft(draft)
      setForm({
        application_id: application_id ?? apps[0]?.id ?? 0,
        name: draft.application_name ? `${draft.application_name} ${draft.level} alert` : `${draft.level} alert`,
        level: draft.level,
        keyword: draft.keyword,
        threshold: draft.threshold,
        window_seconds: draft.window_seconds,
        cooldown_seconds: draft.cooldown_seconds,
      })
      setDialogOpen(true)
    } catch (e) {
      console.error('Failed to parse alert description', e)
    } finally {
      setNlParsing(false)
    }
  }

  async function handleCreate() {
    if (!form.application_id) return
    try {
      await createAlert(form)
      setDialogOpen(false)
      setNlText('')
      setNlDraft(null)
      load()
    } catch (e) {
      console.error('Failed to create alert', e)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAlert(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      console.error('Failed to delete alert', e)
    }
  }

  async function toggleEnabled(rule: AlertRuleView) {
    try {
      await updateAlert(rule.id, { enabled: !rule.enabled })
      load()
    } catch (e) {
      console.error('Failed to toggle alert', e)
    }
  }

  function formatWindow(s: number) {
    if (s >= 3600) return `${s / 3600}h`
    if (s >= 60) return `${s / 60}m`
    return `${s}s`
  }

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Threshold rules with cooldown triage, plus describe-it-in-words authoring."
        actions={<Button onClick={openDialog}><Plus className="h-4 w-4" /> New Alert Rule</Button>}
      />

      {/* NL alert authoring (AI-8) */}
      <Card className="mb-4 border-primary/25 bg-primary/[0.04]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Wand2 className="h-4 w-4 text-primary" /> Describe an alert in plain language
              <Badge variant="outline" className="text-[10px]">AI-8</Badge>
            </Label>
            <Textarea
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              placeholder='e.g. "Alert me when payments-api has more than 5 errors mentioning timeout within 2 minutes"'
              className="min-h-[44px] bg-background"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  parseNL()
                }
              }}
            />
          </div>
          <Button onClick={parseNL} disabled={!nlText.trim() || nlParsing}>
            <Sparkles className="h-4 w-4" />
            {nlParsing ? 'Parsing…' : 'Parse to rule'}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="history">Trigger History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No alert rules yet — describe one above or create one manually.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-medium">{r.name || `${r.level} threshold`}</p>
                          <p className="text-xs text-muted-foreground">{r.application_name || `app #${r.application_id}`}</p>
                        </TableCell>
                        <TableCell><LevelBadge level={r.level as LogLevel} /></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.keyword || '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">≥ {r.threshold} / {formatWindow(r.window_seconds)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatWindow(r.cooldown_seconds)}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => toggleEnabled(r)}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                          >
                            {r.enabled ? 'on' : 'off'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)}>
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
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Observed</TableHead>
                    <TableHead>Triage</TableHead>
                    <TableHead>Triggered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No triggers recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{ev.app_name}</TableCell>
                        <TableCell><LevelBadge level={ev.level as LogLevel} /></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ev.count}/{ev.threshold} in {formatWindow(ev.window_seconds)}
                          {ev.keyword && <> · “{ev.keyword}”</>}
                        </TableCell>
                        <TableCell>
                          {ev.suppressed ? (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <BellOff className="h-3 w-3" /> suppressed by cooldown
                            </Badge>
                          ) : ev.incident_id ? (
                            <Badge variant="outline" className="text-[10px]">linked to incident #{ev.incident_id}</Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px]">fired</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{relativeTime(ev.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create / review dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{nlDraft ? 'Review alert rule' : 'New alert rule'}</DialogTitle>
            {nlDraft && (
              <p className="text-xs text-muted-foreground">
                Parsed from your description (confidence {Math.round(nlDraft.confidence * 100)}%). Nothing is active until you create it.
              </p>
            )}
          </DialogHeader>
          {nlDraft && (nlDraft.notes ?? []).length > 0 && (
            <ul className="space-y-1 rounded-md border border-level-warning/30 bg-level-warning/10 p-2.5 text-xs text-level-warning">
              {(nlDraft.notes ?? []).map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Application</Label>
              <Select value={String(form.application_id)} onValueChange={(v) => setForm({ ...form, application_id: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Choose an application" /></SelectTrigger>
                <SelectContent>
                  {apps.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Keyword</Label>
                <Input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Threshold (count)</Label>
                <Input type="number" min={1} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseInt(e.target.value || '1') })} />
              </div>
              <div className="space-y-1.5">
                <Label>Window (seconds)</Label>
                <Input type="number" min={1} value={form.window_seconds} onChange={(e) => setForm({ ...form, window_seconds: parseInt(e.target.value || '60') })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cooldown (seconds) — repeat breaches inside this window are recorded but don't re-notify</Label>
              <Input type="number" min={0} value={form.cooldown_seconds} onChange={(e) => setForm({ ...form, cooldown_seconds: parseInt(e.target.value || '0') })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.application_id}>Create rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
