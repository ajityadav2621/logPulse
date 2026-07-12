import client from './client'

export interface LogEntry {
  app_name: string
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
  meta?: Record<string, unknown>
}

export interface LogFilters {
  app?: string
  level?: string
  q?: string
}

export async function fetchLogs(filters: LogFilters): Promise<LogEntry[]> {
  const { data } = await client.get('/logs', { params: filters })
  return data
}
