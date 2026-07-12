import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../api/logs'

const MAX_LIVE_LOGS = 200

export function useLogStream() {
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [lastError, setLastError] = useState<LogEntry | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/logs`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (event) => {
      const entry: LogEntry = JSON.parse(event.data)
      setLiveLogs((prev) => [entry, ...prev].slice(0, MAX_LIVE_LOGS))
      if (entry.level === 'error') setLastError(entry)
    }

    return () => ws.close()
  }, [])

  return { liveLogs, connected, lastError }
}
