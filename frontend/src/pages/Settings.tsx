import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTheme } from '@/lib/theme-provider'

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export default function Settings() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <PageHeader title="Settings" description="Configure LogPulse for your organization." />

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="slack">Slack</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="parsing">Log Parsing</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <SettingsCard title="General" description="Workspace-wide display preferences.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-lg">
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select defaultValue="ist">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ist">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="pst">America/Los_Angeles (PST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Theme</Label>
                <Select value={theme} onValueChange={(v) => setTheme(v as 'dark' | 'light')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex max-w-lg items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">Applies across dashboards for every teammate by default.</p>
              </div>
              <Switch checked={theme === 'dark'} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} />
            </label>
            <Button>Save changes</Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="smtp">
          <SettingsCard title="SMTP" description="Used to deliver email alerts and scheduled reports.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-lg">
              <div className="space-y-1.5"><Label>Host</Label><Input placeholder="smtp.company.com" /></div>
              <div className="space-y-1.5"><Label>Port</Label><Input placeholder="587" /></div>
              <div className="space-y-1.5"><Label>Username</Label><Input placeholder="alerts@company.com" /></div>
              <div className="space-y-1.5"><Label>Password</Label><Input type="password" /></div>
            </div>
            <Button>Save SMTP settings</Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="slack">
          <SettingsCard title="Slack" description="Send alert notifications to a Slack channel.">
            <div className="max-w-lg space-y-1.5">
              <Label>Incoming Webhook URL</Label>
              <Input placeholder="https://hooks.slack.com/services/..." />
            </div>
            <div className="max-w-lg space-y-1.5">
              <Label>Default channel</Label>
              <Input placeholder="#alerts" />
            </div>
            <Button>Connect Slack</Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="webhook">
          <SettingsCard title="Webhook" description="POST alert payloads to an external endpoint.">
            <div className="max-w-lg space-y-1.5">
              <Label>Endpoint URL</Label>
              <Input placeholder="https://api.yourteam.com/logpulse-events" />
            </div>
            <div className="max-w-lg space-y-1.5">
              <Label>Secret</Label>
              <Input placeholder="whsec_••••••••••••" />
            </div>
            <Button>Save webhook</Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="retention">
          <SettingsCard title="Retention Policy" description="How long LogPulse keeps raw log data.">
            <div className="max-w-lg space-y-1.5">
              <Label>Retention period</Label>
              <Select defaultValue="90">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex max-w-lg items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Archive before delete</p>
                <p className="text-xs text-muted-foreground">Move expired logs to cold storage instead of deleting them.</p>
              </div>
              <Switch defaultChecked />
            </label>
            <Button>Save policy</Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="backup">
          <SettingsCard title="Backup" description="Automatic backups of configuration and metadata.">
            <label className="flex max-w-lg items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Daily automated backup</p>
                <p className="text-xs text-muted-foreground">Runs every night at 02:00 IST.</p>
              </div>
              <Switch defaultChecked />
            </label>
            <Button variant="outline">Run backup now</Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="parsing">
          <SettingsCard title="Log Parsing" description="Define how incoming raw logs are parsed into structured fields.">
            <div className="max-w-2xl space-y-1.5">
              <Label>Parsing pattern (Grok / Regex)</Label>
              <Textarea rows={4} placeholder={'%{TIMESTAMP_ISO8601:timestamp} \\[%{LOGLEVEL:level}\\] %{GREEDYDATA:message}'} className="font-mono text-sm" />
            </div>
            <Button>Save pattern</Button>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="apikeys">
          <SettingsCard title="API Keys" description="Manage organization-wide ingestion keys.">
            <div className="max-w-lg space-y-1.5">
              <Label>Ingestion key</Label>
              <Input readOnly value="lp_org_9d21ac74be...f30c" className="font-mono" />
            </div>
            <Button variant="outline">Rotate key</Button>
          </SettingsCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}