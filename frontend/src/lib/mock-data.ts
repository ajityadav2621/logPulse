export type LogLevel = 'critical' | 'error' | 'warning' | 'info' | 'debug'

export interface LogRecord {
  id: string
  timestamp: string
  level: LogLevel
  application: string
  module: string
  server: string
  host: string
  environment: 'production' | 'staging' | 'development'
  message: string
  requestId: string
  traceId: string
  spanId: string
  sessionId: string
  userId: string
  api: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  statusCode: number
  responseTimeMs: number
  ip: string
  tags: string[]
}

const APPS = ['checkout-service', 'auth-service', 'payments-api', 'inventory-svc', 'notification-svc', 'user-gateway', 'search-api', 'recommendation-engine']
const SERVERS = ['prod-web-01', 'prod-web-02', 'prod-api-01', 'prod-api-02', 'prod-db-01', 'stage-web-01', 'stage-api-01']
const HOSTS = ['10.20.1.11', '10.20.1.12', '10.20.2.21', '10.20.2.22', '10.20.3.5', '10.20.4.8']
const MODULES = ['OrderController', 'AuthFilter', 'PaymentGateway', 'InventorySync', 'EmailWorker', 'SessionManager', 'SearchIndexer', 'RankingModel']
const ENVIRONMENTS: LogRecord['environment'][] = ['production', 'staging', 'development']
const METHODS: LogRecord['method'][] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
const STATUS_CODES = [200, 200, 200, 201, 204, 400, 401, 403, 404, 500, 502, 503]
const ENDPOINTS = ['/api/orders', '/api/auth/login', '/api/payments/charge', '/api/inventory/sync', '/api/users/:id', '/api/search', '/api/recommendations', '/api/notifications/send']
const TAGS = ['retry', 'timeout', 'cache-miss', 'slow-query', 'rate-limited', 'deprecated', 'external-call', 'db']

const MESSAGES: Record<LogLevel, string[]> = {
  critical: [
    'Database connection pool exhausted',
    'Payment gateway unreachable after 3 retries',
    'Out of memory — service restarting',
    'Primary replica failover triggered',
  ],
  error: [
    'NullPointerException in OrderController.processOrder',
    'Failed to deserialize request payload',
    'Upstream service returned 502',
    'Unhandled exception in async worker',
    'Constraint violation on unique index',
  ],
  warning: [
    'Response time exceeded 2000ms threshold',
    'Deprecated API endpoint called',
    'Retrying request after transient failure',
    'Cache miss rate above 40%',
    'Connection pool nearing capacity',
  ],
  info: [
    'User authenticated successfully',
    'Order #48213 created',
    'Scheduled job completed in 412ms',
    'Cache warmed for region us-east-1',
    'Health check passed',
  ],
  debug: [
    'Entering method calculateShipping()',
    'Query executed in 12ms',
    'Feature flag "new-checkout" evaluated to true',
    'Session token refreshed',
  ],
}

let seed = 42
function rand() {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min
}
function id(prefix: string, len = 8) {
  const chars = 'abcdef0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(rand() * chars.length)]
  return `${prefix}-${s}`
}

const LEVEL_WEIGHTS: [LogLevel, number][] = [
  ['debug', 30],
  ['info', 40],
  ['warning', 15],
  ['error', 11],
  ['critical', 4],
]
function weightedLevel(): LogLevel {
  const total = LEVEL_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [lvl, w] of LEVEL_WEIGHTS) {
    if (r < w) return lvl
    r -= w
  }
  return 'info'
}

function statusForLevel(level: LogLevel): number {
  if (level === 'critical' || level === 'error') return pick([500, 502, 503, 400, 401, 404])
  if (level === 'warning') return pick([400, 403, 404, 200])
  return pick([200, 200, 201, 204])
}

export function generateLog(offsetMs = 0): LogRecord {
  const level = weightedLevel()
  const app = pick(APPS)
  const ts = new Date(Date.now() - offsetMs)
  return {
    id: id('log'),
    timestamp: ts.toISOString(),
    level,
    application: app,
    module: pick(MODULES),
    server: pick(SERVERS),
    host: pick(HOSTS),
    environment: pick(ENVIRONMENTS),
    message: pick(MESSAGES[level]),
    requestId: id('req'),
    traceId: id('trace', 16),
    spanId: id('span', 8),
    sessionId: id('sess'),
    userId: `user_${randInt(1000, 9999)}`,
    api: pick(ENDPOINTS),
    method: pick(METHODS),
    statusCode: statusForLevel(level),
    responseTimeMs: randInt(8, 2400),
    ip: pick(HOSTS),
    tags: Array.from({ length: randInt(0, 2) }, () => pick(TAGS)),
  }
}

export function generateLogs(count: number): LogRecord[] {
  const logs: LogRecord[] = []
  for (let i = 0; i < count; i++) {
    logs.push(generateLog(i * randInt(1000, 15000)))
  }
  return logs.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
}

export const MOCK_LOGS = generateLogs(400)

// ---------- Dashboard summary ----------
export function getSummary() {
  const total = MOCK_LOGS.length
  const byLevel = countBy(MOCK_LOGS, (l) => l.level)
  const today = MOCK_LOGS.filter((l) => new Date(l.timestamp).toDateString() === new Date().toDateString()).length
  return {
    totalLogs: total * 187,
    logsToday: today * 42 + 3180,
    errorLogs: (byLevel.error ?? 0) * 187,
    warningLogs: (byLevel.warning ?? 0) * 187,
    infoLogs: (byLevel.info ?? 0) * 187,
    debugLogs: (byLevel.debug ?? 0) * 187,
    criticalLogs: (byLevel.critical ?? 0) * 187,
    activeServers: SERVERS.length,
    activeApplications: APPS.length,
    activeUsers: 1284,
    alertsTriggered: 17,
    storageUsedGb: 412.6,
    storageCapacityGb: 750,
  }
}

function countBy<T, K extends string | number>(arr: T[], fn: (t: T) => K): Record<K, number> {
  const out = {} as Record<K, number>
  for (const item of arr) {
    const k = fn(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  critical: 'hsl(var(--level-critical))',
  error: 'hsl(var(--level-error))',
  warning: 'hsl(var(--level-warning))',
  info: 'hsl(var(--level-info))',
  debug: 'hsl(var(--level-debug))',
}

export function getLogLevelDistribution() {
  const byLevel = countBy(MOCK_LOGS, (l) => l.level)
  return (['critical', 'error', 'warning', 'info', 'debug'] as LogLevel[]).map((level) => ({
    name: level,
    value: byLevel[level] ?? 0,
    color: LOG_LEVEL_COLORS[level],
  }))
}

export function getHourlyTrend() {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, '0')}:00`,
    logs: randInt(120, 900),
    errors: randInt(5, 60),
  }))
}

export function getDailyTrend(days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      logs: randInt(8000, 22000),
      errors: randInt(80, 900),
    }
  })
}

export function getWeeklyTrend() {
  return Array.from({ length: 8 }, (_, i) => ({ week: `W${i + 1}`, logs: randInt(60000, 140000), errors: randInt(600, 5200) }))
}

export function getMonthlyTrend() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
  return months.map((m) => ({ month: m, logs: randInt(200000, 500000), errors: randInt(2000, 18000) }))
}

export function getRequestsPerMinute() {
  return Array.from({ length: 30 }, (_, i) => ({ t: `${i}m`, requests: randInt(400, 2200) }))
}

export function getResponseTimeSeries() {
  return Array.from({ length: 30 }, (_, i) => ({ t: `${i}m`, p50: randInt(30, 120), p95: randInt(150, 500), p99: randInt(400, 1200) }))
}

export function getTopApplications() {
  return APPS.map((a) => ({ name: a, logs: randInt(4000, 42000) })).sort((a, b) => b.logs - a.logs).slice(0, 6)
}

export function getTopServers() {
  return SERVERS.map((s) => ({ name: s, logs: randInt(3000, 38000) })).sort((a, b) => b.logs - a.logs).slice(0, 6)
}

export function getTopErrorTypes() {
  return [
    { name: 'NullPointerException', count: 842 },
    { name: 'TimeoutException', count: 611 },
    { name: 'ConnectionRefused', count: 498 },
    { name: 'ConstraintViolation', count: 355 },
    { name: 'DeserializationError', count: 289 },
    { name: 'RateLimitExceeded', count: 172 },
  ]
}

export function getStatusCodeDistribution() {
  return [
    { name: '200', value: 68, color: 'hsl(var(--level-info))' },
    { name: '400', value: 7, color: 'hsl(var(--level-warning))' },
    { name: '401', value: 4, color: 'hsl(var(--level-debug))' },
    { name: '403', value: 3, color: 'hsl(var(--level-debug))' },
    { name: '404', value: 8, color: 'hsl(var(--muted-foreground))' },
    { name: '500', value: 6, color: 'hsl(var(--level-error))' },
    { name: '502', value: 3, color: 'hsl(var(--level-critical))' },
    { name: '503', value: 1, color: 'hsl(var(--level-critical))' },
  ]
}

export function getGauges() {
  return { cpu: 62, memory: 74, disk: 48, storage: 55 }
}

export const SYSTEM_HEALTH: { name: string; status: 'green' | 'yellow' | 'red' }[] = [
  { name: 'API Gateway', status: 'green' },
  { name: 'Auth Service', status: 'green' },
  { name: 'Payments API', status: 'yellow' },
  { name: 'Search Cluster', status: 'green' },
  { name: 'Message Queue', status: 'red' },
  { name: 'Primary Database', status: 'green' },
]

// ---------- Applications ----------
export interface Application {
  id: string
  name: string
  status: 'running' | 'degraded' | 'stopped'
  environment: string
  owner: string
  serverCount: number
  version: string
  lastDeployment: string
  logCount: number
  health: 'green' | 'yellow' | 'red'
}
export const APPLICATIONS: Application[] = APPS.map((name, i) => ({
  id: `app-${i}`,
  name,
  status: pick(['running', 'running', 'running', 'degraded', 'stopped']),
  environment: pick(ENVIRONMENTS),
  owner: pick(['Platform Team', 'Payments Team', 'Growth Team', 'Core Infra', 'Data Team']),
  serverCount: randInt(2, 8),
  version: `v${randInt(1, 4)}.${randInt(0, 9)}.${randInt(0, 9)}`,
  lastDeployment: new Date(Date.now() - randInt(1, 30) * 86400000).toISOString(),
  logCount: randInt(5000, 90000),
  health: pick(['green', 'green', 'green', 'yellow', 'red']),
}))

// ---------- Servers ----------
export interface Server {
  id: string
  name: string
  ip: string
  location: string
  cpu: number
  ram: number
  disk: number
  os: string
  status: 'online' | 'offline' | 'maintenance'
  services: string[]
  logCount: number
}
export const SERVERS_LIST: Server[] = SERVERS.map((name, i) => ({
  id: `srv-${i}`,
  name,
  ip: `10.20.${randInt(1, 9)}.${randInt(2, 254)}`,
  location: pick(['us-east-1', 'us-west-2', 'eu-central-1', 'ap-south-1']),
  cpu: randInt(20, 92),
  ram: randInt(30, 88),
  disk: randInt(25, 80),
  os: pick(['Ubuntu 22.04', 'Ubuntu 24.04', 'Amazon Linux 2023', 'RHEL 9']),
  status: pick(['online', 'online', 'online', 'maintenance', 'offline']),
  services: pick([
    ['nginx', 'app-server', 'redis'],
    ['postgres', 'pgbouncer'],
    ['app-server', 'sidekiq'],
    ['elasticsearch', 'logstash'],
  ]),
  logCount: randInt(3000, 40000),
}))

// ---------- Alerts ----------
export interface AlertRule {
  id: string
  name: string
  metric: string
  threshold: string
  channel: 'Email' | 'Slack' | 'Webhook'
  severity: LogLevel
  enabled: boolean
}
export const ALERT_RULES: AlertRule[] = [
  { id: 'ar-1', name: 'High error rate', metric: 'error_rate > 5%', threshold: '5% over 5 min', channel: 'Slack', severity: 'critical', enabled: true },
  { id: 'ar-2', name: 'API latency spike', metric: 'p95_latency > 800ms', threshold: '800ms over 10 min', channel: 'Email', severity: 'warning', enabled: true },
  { id: 'ar-3', name: 'Server CPU critical', metric: 'cpu_usage > 90%', threshold: '90% for 3 min', channel: 'Webhook', severity: 'critical', enabled: true },
  { id: 'ar-4', name: 'Disk space low', metric: 'disk_free < 10%', threshold: '10% remaining', channel: 'Email', severity: 'warning', enabled: false },
  { id: 'ar-5', name: 'Auth failures spike', metric: 'failed_logins > 50/min', threshold: '50 per minute', channel: 'Slack', severity: 'error', enabled: true },
  { id: 'ar-6', name: 'Queue backlog', metric: 'queue_depth > 10000', threshold: '10k messages', channel: 'Webhook', severity: 'warning', enabled: true },
]

export interface AlertHistoryItem {
  id: string
  rule: string
  severity: LogLevel
  status: 'resolved' | 'pending' | 'acknowledged'
  triggeredAt: string
  message: string
}
export const ALERT_HISTORY: AlertHistoryItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: `ah-${i}`,
  rule: pick(ALERT_RULES).name,
  severity: pick(['critical', 'error', 'warning']),
  status: pick(['resolved', 'resolved', 'pending', 'acknowledged']),
  triggeredAt: new Date(Date.now() - randInt(1, 96) * 3600000).toISOString(),
  message: pick(MESSAGES.critical.concat(MESSAGES.error, MESSAGES.warning)),
}))

// ---------- Incidents ----------
export interface Incident {
  id: string
  name: string
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4'
  assignedTo: string
  status: 'open' | 'investigating' | 'monitoring' | 'resolved'
  created: string
  resolved?: string
}
export const INCIDENTS: Incident[] = Array.from({ length: 10 }, (_, i) => ({
  id: `INC-${1042 + i}`,
  name: pick([
    'Checkout service elevated error rate',
    'Payments API timeout spike',
    'Auth service degraded latency',
    'Search cluster node down',
    'Database replica lag',
    'Notification delivery delays',
  ]),
  severity: pick(['sev1', 'sev2', 'sev2', 'sev3', 'sev4']),
  assignedTo: pick(['A. Sharma', 'K. Rao', 'M. Chen', 'J. Patel', 'S. Iyer']),
  status: pick(['open', 'investigating', 'monitoring', 'resolved', 'resolved']),
  created: new Date(Date.now() - randInt(1, 20) * 86400000).toISOString(),
  resolved: rand() > 0.5 ? new Date(Date.now() - randInt(0, 10) * 86400000).toISOString() : undefined,
}))

// ---------- Saved searches ----------
export interface SavedSearch {
  id: string
  name: string
  query: string
  createdBy: string
  shared: boolean
  favorite: boolean
}
export const SAVED_SEARCHES: SavedSearch[] = [
  { id: 'ss-1', name: '5xx errors — payments', query: 'application:payments-api AND status_code:>=500', createdBy: 'A. Sharma', shared: true, favorite: true },
  { id: 'ss-2', name: 'Slow checkout requests', query: 'application:checkout-service AND response_time:>1000', createdBy: 'K. Rao', shared: true, favorite: false },
  { id: 'ss-3', name: 'Failed logins', query: 'module:AuthFilter AND message:"authentication failed"', createdBy: 'M. Chen', shared: false, favorite: true },
  { id: 'ss-4', name: 'Staging debug noise', query: 'environment:staging AND level:debug', createdBy: 'You', shared: false, favorite: false },
  { id: 'ss-5', name: 'Rate-limited requests', query: 'tags:rate-limited', createdBy: 'S. Iyer', shared: true, favorite: false },
]

// ---------- Reports ----------
export interface ReportItem {
  id: string
  name: string
  type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom'
  generated: string
  format: 'PDF' | 'Excel'
}
export const REPORTS: ReportItem[] = [
  { id: 'rp-1', name: 'Daily Ops Summary', type: 'Daily', generated: new Date(Date.now() - 3600e3).toISOString(), format: 'PDF' },
  { id: 'rp-2', name: 'Weekly Error Trends', type: 'Weekly', generated: new Date(Date.now() - 86400e3).toISOString(), format: 'Excel' },
  { id: 'rp-3', name: 'Monthly SLA Report', type: 'Monthly', generated: new Date(Date.now() - 3 * 86400e3).toISOString(), format: 'PDF' },
  { id: 'rp-4', name: 'Q2 Incident Review', type: 'Custom', generated: new Date(Date.now() - 10 * 86400e3).toISOString(), format: 'PDF' },
]

// ---------- Notifications ----------
export interface AppNotification {
  id: string
  type: 'Server Down' | 'API Failure' | 'High CPU' | 'High Memory' | 'High Error Rate'
  message: string
  read: boolean
  createdAt: string
}
export const NOTIFICATIONS: AppNotification[] = Array.from({ length: 12 }, (_, i) => ({
  id: `nt-${i}`,
  type: pick(['Server Down', 'API Failure', 'High CPU', 'High Memory', 'High Error Rate']),
  message: pick([
    'prod-api-02 stopped responding to health checks',
    'payments-api returned 5xx for 6% of requests',
    'prod-web-01 CPU usage sustained above 90%',
    'prod-db-01 memory usage crossed 85%',
    'checkout-service error rate crossed alert threshold',
  ]),
  read: i > 3,
  createdAt: new Date(Date.now() - i * 3400 * 1000).toISOString(),
}))

// ---------- Users ----------
export interface AppUser {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Editor' | 'Viewer'
  status: 'active' | 'invited' | 'deactivated'
  lastActive: string
}
export const USERS: AppUser[] = [
  { id: 'u-1', name: 'Aditi Sharma', email: 'aditi.sharma@logpulse.io', role: 'Admin', status: 'active', lastActive: new Date().toISOString() },
  { id: 'u-2', name: 'Karan Rao', email: 'karan.rao@logpulse.io', role: 'Editor', status: 'active', lastActive: new Date(Date.now() - 3600e3).toISOString() },
  { id: 'u-3', name: 'Meera Chen', email: 'meera.chen@logpulse.io', role: 'Editor', status: 'active', lastActive: new Date(Date.now() - 7200e3).toISOString() },
  { id: 'u-4', name: 'Jai Patel', email: 'jai.patel@logpulse.io', role: 'Viewer', status: 'invited', lastActive: new Date(Date.now() - 86400e3 * 4).toISOString() },
  { id: 'u-5', name: 'Sana Iyer', email: 'sana.iyer@logpulse.io', role: 'Viewer', status: 'deactivated', lastActive: new Date(Date.now() - 86400e3 * 40).toISOString() },
]

export const AUDIT_LOGS = Array.from({ length: 10 }, (_, i) => ({
  id: `au-${i}`,
  actor: pick(USERS).name,
  action: pick(['Updated alert rule', 'Invited user', 'Deactivated user', 'Changed retention policy', 'Rotated API key', 'Updated SMTP settings']),
  timestamp: new Date(Date.now() - randInt(1, 200) * 3600000).toISOString(),
}))

// ---------- Analytics ----------
export function getTopApis() {
  return ENDPOINTS.map((e) => ({ name: e, requests: randInt(4000, 90000) })).sort((a, b) => b.requests - a.requests)
}
export function getSlowApis() {
  return ENDPOINTS.map((e) => ({ name: e, avgMs: randInt(80, 1800) })).sort((a, b) => b.avgMs - a.avgMs)
}
export function getPeakHours() {
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: randInt(80, 1400) }))
}