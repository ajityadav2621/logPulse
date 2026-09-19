import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Copy, Bookmark } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'

function Field({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? 'break-all font-mono text-sm' : 'text-sm'}>{value}</p>
    </div>
  )
}

export default function LogDetails() {
  const { id } = useParams()
  const location = useNavigate()
  const log = (location as any)?.state

  if (!log) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <EmptyState title="Log not found" description="Select a log from Log Explorer to view details." />
      </div>
    )
  }

  const rawLog = `${log.timestamp || ''} [${log.level?.toUpperCase() || ''}] ${log.app_name || ''} - ${log.message || ''}`

  const jsonLog = JSON.stringify(log, null, 2)

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-3 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Log Explorer
      </Button>

      <PageHeader
        title="Log Details"
        description={String(log.id || id)}
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Download</Button>
            <Button variant="outline" size="sm"><Copy className="h-4 w-4" /> Copy</Button>
            <Button variant="outline" size="sm"><Bookmark className="h-4 w-4" /> Bookmark</Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <LevelBadge level={log.level} className="text-sm" />
          <span className="font-mono text-sm text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</span>
          <span className="ml-auto text-sm font-medium">{log.app_name}</span>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payloads">Payloads</TabsTrigger>
          <TabsTrigger value="json">JSON Viewer</TabsTrigger>
          <TabsTrigger value="raw">Raw Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Application" value={log.app_name} mono={false} />
              <Field label="Level" value={log.level} mono={false} />
              <Field label="Message" value={log.message} mono={false} />
              <Field label="Timestamp" value={log.timestamp} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payloads">
          <Card>
            <CardContent className="p-5">
              <pre className="scrollbar-thin overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {JSON.stringify(log.meta || {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardContent className="p-5">
              <pre className="scrollbar-thin overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{jsonLog}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardContent className="p-5">
              <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{rawLog}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}