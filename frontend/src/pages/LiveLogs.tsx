import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Trash2, Download, Wifi, WifiOff } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LevelBadge } from '@/components/shared/LevelBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { generateLog, type LogRecord } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const MAX_LOGS = 300

export default function LiveLogs() {
  const [logs, setLogs] = useState<LogRecord[]>(() => Array.from({ length: 30 }, (_, i) => generateLog(i * 800)))
  const [paused, setPaused] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightErrors, setHighlightErrors] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [connected, setConnected] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (paused || !autoRefresh) return
    const interval = setInterval(() => {
      setLogs((prev) => [generateLog(0), ...prev].slice(0, MAX_LOGS))
    }, 900)
    return () => clearInterval(interval)
  }, [paused, autoRefresh])

  useEffect(() => {
    const flicker = setInterval(() => {
      setConnected((c) => (Math.random() > 0.04 ? true : !c))
    }, 4000)
    return () => clearInterval(flicker)
  }, [])

  const visible = logs.filter((l) => !query || l.message.toLowerCase().includes(query.toLowerCase()) || l.application.includes(query))

  function downloadLogs() {
    const blob = new Blob([visible.map((l) => `${l.timestamp} [${l.level.toUpperCase()}] ${l.application}: ${l.message}`).join('\n')], {
      type: 'text/plain',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'live-logs.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Live Logs"
        description="Streaming logs in real time across every connected application."
        actions={
          <span className={cn('flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium', connected ? 'border-primary/30 bg-primary/10 text-primary' : 'border-level-error/30 bg-level-error/10 text-level-error')}>
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'WebSocket connected' : 'Reconnecting…'}
          </span>
        }
      />

      <Card className="mb-3 flex flex-wrap items-center gap-3 p-3">
        <Input placeholder="Search live stream..." value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />

        <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLogs([])}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
        <Button variant="outline" size="sm" onClick={downloadLogs}>
          <Download className="h-4 w-4" /> Download
        </Button>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Highlight errors
          <Switch checked={highlightErrors} onCheckedChange={setHighlightErrors} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Auto refresh
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
        </label>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="scrollbar-thin h-full overflow-y-auto p-3 font-mono text-xs leading-relaxed">
          {visible.length === 0 && <p className="p-6 text-center text-muted-foreground">No logs to show — stream is cleared or paused.</p>}
          {visible.map((log) => {
            const isError = log.level === 'error' || log.level === 'critical'
            return (
              <div
                key={log.id}
                className={cn(
                  'flex items-start gap-2 rounded px-1.5 py-1 animate-row-in',
                  highlightErrors && isError && 'bg-level-error/10'
                )}
              >
                <span className="shrink-0 text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <LevelBadge level={log.level} className="shrink-0 px-1.5 py-0 text-[10px]" />
                <span className="shrink-0 text-muted-foreground">{log.server}</span>
                <span className={cn('truncate', highlightErrors && isError ? 'text-level-error' : 'text-foreground/90')}>
                  <span className="text-muted-foreground">{log.application}:</span> {log.message}
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}