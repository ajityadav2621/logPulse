import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Copy, Bookmark } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { MOCK_LOGS, generateLog, type LogRecord } from '@/lib/mock-data'

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
  const location = useLocation()
  const navigate = useNavigate()

  const log: LogRecord = (location.state as LogRecord) ?? MOCK_LOGS.find((l) => l.id === id) ?? generateLog()

  const rawLog = `${log.timestamp} [${log.level.toUpperCase()}] ${log.application} (${log.module}) - ${log.message} request_id=${log.requestId} trace_id=${log.traceId}`

  const jsonLog = JSON.stringify(log, null, 2)

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Log Explorer
      </Button>

      <PageHeader
        title="Log Details"
        description={log.id}
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
          <Badge variant="outline" className="capitalize">{log.environment}</Badge>
          <span className="font-mono text-sm text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
          <span className="ml-auto text-sm font-medium">{log.application}</span>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="payloads">Payloads</TabsTrigger>
          <TabsTrigger value="exception">Exception</TabsTrigger>
          <TabsTrigger value="json">JSON Viewer</TabsTrigger>
          <TabsTrigger value="raw">Raw Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Application" value={log.application} mono={false} />
              <Field label="Environment" value={log.environment} mono={false} />
              <Field label="Server" value={log.server} />
              <Field label="Host / IP" value={log.host} />
              <Field label="Thread" value={`pool-2-thread-${(log.id.charCodeAt(4) % 9) + 1}`} />
              <Field label="Module" value={log.module} mono={false} />
              <Field label="Request ID" value={log.requestId} />
              <Field label="Trace ID" value={log.traceId} />
              <Field label="Span ID" value={log.spanId} />
              <Field label="Session ID" value={log.sessionId} />
              <Field label="User" value={log.userId} />
              <Field label="IP Address" value={log.ip} />
              <Field label="API" value={log.api} />
              <Field label="Method" value={log.method} />
              <Field label="Status Code" value={log.statusCode} />
              <Field label="Duration" value={`${log.responseTimeMs} ms`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="headers">
          <Card>
            <CardContent className="space-y-1.5 p-5 font-mono text-sm">
              <p>content-type: application/json</p>
              <p>authorization: Bearer ••••••••{log.sessionId.slice(-6)}</p>
              <p>x-request-id: {log.requestId}</p>
              <p>x-trace-id: {log.traceId}</p>
              <p>user-agent: Mozilla/5.0 (compatible; LogPulseAgent/2.4)</p>
              <p>accept-encoding: gzip, deflate, br</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payloads">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Request Payload</p>
                <pre className="scrollbar-thin overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
{`{
  "userId": "${log.userId}",
  "endpoint": "${log.api}",
  "method": "${log.method}"
}`}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Response Payload</p>
                <pre className="scrollbar-thin overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
{`{
  "status": ${log.statusCode},
  "durationMs": ${log.responseTimeMs},
  "traceId": "${log.traceId}"
}`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exception">
          <Card>
            <CardContent className="p-5">
              {log.level === 'error' || log.level === 'critical' ? (
                <>
                  <p className="mb-2 font-mono text-sm text-level-error">{log.message}</p>
                  <pre className="scrollbar-thin overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
{`at com.logpulse.${log.module}.handle(${log.module}.java:142)
at com.logpulse.core.Dispatcher.dispatch(Dispatcher.java:88)
at com.logpulse.core.RequestPipeline.run(RequestPipeline.java:53)
at java.base/java.lang.Thread.run(Thread.java:1583)`}
                  </pre>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No exception was recorded for this log entry.</p>
              )}
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