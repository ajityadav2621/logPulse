export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  app_name: string
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
  timestamp: string
}

export interface ClientOptions {
  baseURL?: string
  bufferSize?: number
  flushInterval?: number
  httpClient?: typeof fetch
}

const DEFAULT_BASE_URL = 'http://localhost:8080'
const DEFAULT_BUFFER_SIZE = 100
const DEFAULT_FLUSH_INTERVAL = 5000

export class LogPulseClient {
  private apiKey: string
  private appName: string
  private baseURL: string
  private buffer: LogEntry[] = []
  private bufferSize: number
  private flushInterval: number
  private httpClient: typeof fetch
  private flushTimer: NodeJS.Timeout | null = null
  private closed = false

  constructor(apiKey: string, appName: string, options: ClientOptions = {}) {
    this.apiKey = apiKey
    this.appName = appName
    this.baseURL = options.baseURL || DEFAULT_BASE_URL
    this.bufferSize = options.bufferSize || DEFAULT_BUFFER_SIZE
    this.flushInterval = options.flushInterval || DEFAULT_FLUSH_INTERVAL
    this.httpClient = options.httpClient || fetch.bind(globalThis)

    this.startFlushTimer()
  }

  private startFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval)
  }

  private async sendSync(entry: LogEntry): Promise<void> {
    const res = await this.httpClient(`${this.baseURL}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(entry),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error')
      console.error(`logpulse: ingest failed with status ${res.status}: ${text}`)
    }
  }

  private enqueue(entry: LogEntry): void {
    if (this.closed) return
    if (this.buffer.length >= this.bufferSize) {
      this.sendSync(entry).catch(() => {})
      return
    }
    this.buffer.push(entry)
  }

  async flush(): Promise<void> {
    const batch = this.buffer.splice(0, this.buffer.length)
    await Promise.all(batch.map((entry) => this.sendSync(entry).catch(() => {})))
  }

  log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      app_name: this.appName,
      level,
      message,
      meta: fields,
      timestamp: new Date().toISOString(),
    }
    this.enqueue(entry)
  }

  info(message: string, fields: Record<string, unknown> = {}): void {
    this.log('info', message, fields)
  }

  warn(message: string, fields: Record<string, unknown> = {}): void {
    this.log('warn', message, fields)
  }

  error(message: string, fields: Record<string, unknown> = {}): void {
    this.log('error', message, fields)
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.flushTimer) clearInterval(this.flushTimer)
    await this.flush()
  }
}

let globalClient: LogPulseClient | null = null

export function initGlobal(apiKey: string, appName: string, options?: ClientOptions): void {
  globalClient = new LogPulseClient(apiKey, appName, options)
}

export function getGlobal(): LogPulseClient | null {
  return globalClient
}

export function globalInfo(message: string, fields?: Record<string, unknown>): void {
  if (!globalClient) {
    console.error('logpulse: global client not initialized')
    return
  }
  globalClient.info(message, fields)
}

export function globalWarn(message: string, fields?: Record<string, unknown>): void {
  if (!globalClient) {
    console.error('logpulse: global client not initialized')
    return
  }
  globalClient.warn(message, fields)
}

export function globalError(message: string, fields?: Record<string, unknown>): void {
  if (!globalClient) {
    console.error('logpulse: global client not initialized')
    return
  }
  globalClient.error(message, fields)
}
