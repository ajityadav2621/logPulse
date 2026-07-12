import { useState } from 'react'
import { Plus, Mail, Slack, Webhook } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ALERT_RULES, ALERT_HISTORY } from '@/lib/mock-data'
import { relativeTime } from '@/lib/utils'

const CHANNEL_ICON: Record<string, any> = { Email: Mail, Slack: Slack, Webhook: Webhook }

export default function Alerts() {
  const [rules, setRules] = useState(ALERT_RULES)
  const [dialogOpen, setDialogOpen] = useState(false)

  function toggleRule(id: string) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Alert rules and their trigger history."
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Alert Rule</Button>}
      />

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="history">Alert History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => {
                    const Icon = CHANNEL_ICON[r.channel]
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.threshold}</TableCell>
                        <TableCell><LevelBadge level={r.severity} /></TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" /> {r.channel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={r.enabled} onCheckedChange={() => toggleRule(r.id)} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
                    <TableHead>Rule</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Triggered</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALERT_HISTORY.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.rule}</TableCell>
                      <TableCell><LevelBadge level={a.severity} /></TableCell>
                      <TableCell><span className="capitalize text-muted-foreground">{a.status}</span></TableCell>
                      <TableCell className="text-muted-foreground">{relativeTime(a.triggeredAt)}</TableCell>
                      <TableCell className="max-w-md truncate text-muted-foreground">{a.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New alert rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rule name</Label>
              <Input placeholder="e.g. High error rate" />
            </div>
            <div className="space-y-1.5">
              <Label>Threshold</Label>
              <Input placeholder="e.g. error_rate > 5% over 5 min" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => setDialogOpen(false)}>Create rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}