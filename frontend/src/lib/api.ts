// Thin fetch wrapper around the Go backend. Handles the base URL, the
// Authorization header, and turning backend error payloads into a typed
// error the UI can display directly.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Developer docs site (Docusaurus) — runs separately; overridable at build.
export const DOCS_URL = import.meta.env.VITE_DOCS_URL || 'http://localhost:3001'
const TOKEN_KEY = 'lp_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Skip attaching the Authorization header (login itself, for example). */
  skipAuth?: boolean
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  }

  if (!skipAuth) {
    const token = getToken()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content and similar — nothing to parse.
  if (res.status === 204) return undefined as T

  let data: any = null
  try {
    data = await res.json()
  } catch {
    // non-JSON response body — fall through with data = null
  }

  if (!res.ok) {
    const message = data?.error || `Request failed with status ${res.status}`
    throw new ApiError(res.status, message)
  }

  return data as T
}

// ---- Shapes returned by the backend (internal/handlers/*.go) ----

export type UserRole = 'admin' | 'editor' | 'viewer'
export type UserStatus = 'invited' | 'active' | 'deactivated'
export type AuthProvider = 'local' | 'google' | 'github'

export interface BackendUser {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  provider: AuthProvider
  avatar_url: string
  last_login_at: string | null
  created_at: string
}

export interface LoginResponse {
  token: string
  user: BackendUser
}

export interface CreateUserResponse {
  user: BackendUser
  invite_link: string
}

export interface AuditLogEntry {
  id: number
  actor_id: number
  action: string
  target_id: number | null
  detail: string
  created_at: string
}

export interface Application {
  id: number
  name: string
  api_key: string
  owner_id: number
  created_at: string
}

export interface AlertRule {
  id: number
  application_id: number
  name: string
  level: string
  keyword: string
  threshold: number
  window_seconds: number
  cooldown_seconds: number
  enabled: boolean
}

export interface SavedSearch {
  id: number
  name: string
  filters: string
  user_id: number
  created_at: string
  updated_at: string
}

export interface Dashboard {
  id: number
  name: string
  user_id: number
  created_at: string
  updated_at: string
}

export interface DashboardWidget {
  id: number
  dashboard_id: number
  type: string
  title: string
  config: string
  position: number
  created_at: string
  updated_at: string
}

export interface Report {
  id: number
  name: string
  type: string
  format: string
  filters: string
  user_id: number
  created_at: string
  updated_at: string
}

export interface Notification {
  id: number
  user_id: number
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

export interface LogEntry {
  id: string
  app_name: string
  level: string
  message: string
  meta?: Record<string, unknown>
  timestamp: string
  pattern_hash?: string
  pattern?: string
}

// ---- Advanced monitoring (stats, AI-1..AI-8) ----

export interface StatsOverview {
  logs_24h: number
  logs_1h: number
  errors_24h: number
  error_rate_24h: number
  error_rate_prev_24h: number
  active_apps: number
  open_incidents: number
  open_anomalies: number
  suppressed_alerts_1h: number
  logs_per_min: number
}

export interface TimeseriesPoint {
  bucket: string
  total: number
  critical: number
  error: number
  warning: number
  info: number
  debug: number
  error_rate: number
}

export interface TopApp {
  app_name: string
  total: number
  errors: number
  error_rate: number
}

export interface LogCluster {
  pattern_hash: string
  pattern: string
  sample_message: string
  count: number
  level: string
  apps: string[]
  first_seen: string
  last_seen: string
}

export interface AnomalyResult {
  app_name: string
  kind: 'volume_spike' | 'volume_drop' | 'error_rate'
  score: number
  observed: number
  expected: number
  message: string
  severity: string
  detected_at: string
}

export interface ForecastPoint {
  bucket: string
  predicted: number
  lower: number
  upper: number
}

export interface Forecast {
  app_name: string
  generated_at: string
  history_hours: number
  current_daily: number
  predicted_daily: number
  growth_per_day: number
  estimated_bytes_per_log: number
  days_to_double: number
  storage_30d_gb: number
  points: ForecastPoint[]
  baseline: TimeseriesPoint[]
  note: string
}

export interface AppHealth {
  app_name: string
  status: 'healthy' | 'degraded' | 'offline' | 'no_data'
  logs_1h: number
  errors_1h: number
  error_rate_1h: number
  logs_24h: number
  last_seen: string | null
}

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved'

export interface Incident {
  id: number
  title: string
  severity: string
  status: IncidentStatus
  source: 'anomaly' | 'correlation' | 'alert' | 'manual'
  summary: string
  evidence: string
  affected_apps: string
  alert_event_ids: string
  started_at: string
  resolved_at: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export interface IncidentEvidenceItem {
  app_name: string
  level: string
  message: string
  timestamp: string
  log_id?: string
}

export interface IncidentHypothesis {
  statement: string
  confidence: number
  rationale: string
  evidence: IncidentEvidenceItem[]
}

export interface CopilotAnalysis {
  incident_id: number
  title: string
  summary: string
  timeline: { bucket: string; total: number; errors: number }[]
  signatures: LogCluster[]
  affected_apps: string[]
  field_hints: { key: string; values: Record<string, number>; hint?: string }[]
  hypotheses: IncidentHypothesis[]
  evidence: IncidentEvidenceItem[]
  generated_at: string
  note: string
}

export interface AlertRuleView extends AlertRule {
  application_name: string
}

export interface AlertEvent {
  id: number
  rule_id: number
  app_name: string
  level: string
  keyword: string
  count: number
  threshold: number
  window_seconds: number
  suppressed: boolean
  incident_id: number | null
  created_at: string
}

export interface ParsedAlertDraft {
  application_name: string
  level: string
  keyword: string
  threshold: number
  window_seconds: number
  cooldown_seconds: number
  confidence: number
  notes: string[]
}

// ---- Auth endpoints ----

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  })
}

export function acceptInvite(token: string, name: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/accept-invite', {
    method: 'POST',
    body: { token, name, password },
    skipAuth: true,
  })
}

export function forgotPassword(email: string) {
  return apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuth: true,
  })
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<LoginResponse>('/api/auth/reset-password', {
    method: 'POST',
    body: { token, new_password: newPassword },
    skipAuth: true,
  })
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<LoginResponse>('/api/auth/change-password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  })
}

export function updateAccount(updates: { name?: string; email?: string; current_password?: string }) {
  return apiFetch<{ user: BackendUser; token?: string }>('/api/auth/account', {
    method: 'PATCH',
    body: updates,
  })
}

export function fetchMe() {
  return apiFetch<BackendUser>('/api/auth/me')
}

export function googleLoginUrl() {
  return `${API_URL}/api/auth/google/login`
}

export function githubLoginUrl() {
  return `${API_URL}/api/auth/github/login`
}

// ---- Admin: user management ----

export function listUsers() {
  return apiFetch<BackendUser[]>('/api/admin/users')
}

export function createUser(name: string, email: string, role: UserRole) {
  return apiFetch<CreateUserResponse>('/api/admin/users', {
    method: 'POST',
    body: { name, email, role },
  })
}

export function updateUserRole(id: number, role: UserRole) {
  return apiFetch<{ status: string }>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: { role },
  })
}

export function deactivateUser(id: number) {
  return apiFetch<{ status: string }>(`/api/admin/users/${id}/deactivate`, { method: 'POST' })
}

export function reactivateUser(id: number) {
  return apiFetch<{ status: string }>(`/api/admin/users/${id}/reactivate`, { method: 'POST' })
}

export function listAuditLogs() {
  return apiFetch<AuditLogEntry[]>('/api/admin/audit-logs')
}

// ---- Applications ----

export function listApplications() {
  return apiFetch<Application[]>('/api/applications')
}

export function createApplication(name: string) {
  return apiFetch<Application>('/api/applications', {
    method: 'POST',
    body: { name },
  })
}

export function deleteApplication(id: number) {
  return apiFetch<{ status: string }>(`/api/admin/applications/${id}`, {
    method: 'DELETE',
  })
}

// ---- Alerts ----

export function listAlerts(applicationId?: number) {
  const params = applicationId ? `?application_id=${applicationId}` : ''
  return apiFetch<AlertRuleView[]>(`/api/alerts${params}`)
}

export function createAlert(rule: {
  application_id: number
  name?: string
  level: string
  keyword?: string
  threshold: number
  window_seconds: number
  cooldown_seconds?: number
}) {
  return apiFetch<AlertRule>('/api/alerts', {
    method: 'POST',
    body: rule,
  })
}

export function updateAlert(id: number, updates: Partial<AlertRule>) {
  return apiFetch<AlertRule>(`/api/alerts/${id}`, {
    method: 'PATCH',
    body: updates,
  })
}

export function deleteAlert(id: number) {
  return apiFetch<{ status: string }>(`/api/alerts/${id}`, {
    method: 'DELETE',
  })
}

// ---- Saved Searches ----

export function listSavedSearches() {
  return apiFetch<SavedSearch[]>('/api/saved-searches')
}

export function createSavedSearch(name: string, filters: string) {
  return apiFetch<SavedSearch>('/api/saved-searches', {
    method: 'POST',
    body: { name, filters },
  })
}

export function updateSavedSearch(id: number, name: string, filters: string) {
  return apiFetch<SavedSearch>(`/api/saved-searches/${id}`, {
    method: 'PATCH',
    body: { name, filters },
  })
}

export function deleteSavedSearch(id: number) {
  return apiFetch<{ status: string }>(`/api/saved-searches/${id}`, {
    method: 'DELETE',
  })
}

// ---- Dashboards ----

export function listDashboards() {
  return apiFetch<Dashboard[]>('/api/dashboards')
}

export function createDashboard(name: string) {
  return apiFetch<Dashboard>('/api/dashboards', {
    method: 'POST',
    body: { name },
  })
}

export function updateDashboard(id: number, name: string) {
  return apiFetch<Dashboard>(`/api/dashboards/${id}`, {
    method: 'PATCH',
    body: { name },
  })
}

export function deleteDashboard(id: number) {
  return apiFetch<{ status: string }>(`/api/dashboards/${id}`, {
    method: 'DELETE',
  })
}

export function addWidget(dashboardId: number, type: string, title: string, config: string, position?: number) {
  return apiFetch<DashboardWidget>('/api/dashboards/widgets', {
    method: 'POST',
    body: { dashboard_id: dashboardId, type, title, config, position },
  })
}

export function listWidgets(dashboardId: number) {
  return apiFetch<DashboardWidget[]>(`/api/dashboards/${dashboardId}/widgets`)
}

export function deleteWidget(widgetId: number) {
  return apiFetch<{ status: string }>(`/api/dashboards/widgets/${widgetId}`, {
    method: 'DELETE',
  })
}

// ---- Reports ----

export function listReports() {
  return apiFetch<Report[]>('/api/reports')
}

export function createReport(report: Omit<Report, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  return apiFetch<Report>('/api/reports', {
    method: 'POST',
    body: report,
  })
}

export function deleteReport(id: number) {
  return apiFetch<{ status: string }>(`/api/reports/${id}`, {
    method: 'DELETE',
  })
}

export function exportReport(id: number) {
  return apiFetch<Blob>(`/api/reports/${id}/export`, {
    method: 'GET',
  })
}

// ---- Notifications ----

export function listNotifications(unreadOnly?: boolean) {
  const params = unreadOnly ? '?unread=true' : ''
  return apiFetch<Notification[]>(`/api/notifications${params}`)
}

export function createNotification(title: string, message: string, type: string) {
  return apiFetch<Notification>('/api/notifications', {
    method: 'POST',
    body: { title, message, type },
  })
}

export function markNotificationRead(id: number) {
  return apiFetch<Notification>(`/api/notifications/${id}/read`, {
    method: 'POST',
  })
}

export function markAllNotificationsRead() {
  return apiFetch<{ status: string }>('/api/notifications/read-all', {
    method: 'POST',
  })
}

export function getUnreadNotificationCount() {
  return apiFetch<{ count: number }>('/api/notifications/unread-count')
}

// ---- Logs ----

export function fetchLogs(params: Record<string, string | number>) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)))
  return apiFetch<LogEntry[]>(`/api/logs?${qs.toString()}`)
}

// ---- Advanced monitoring endpoints ----

export function fetchOverview() {
  return apiFetch<StatsOverview>('/api/stats/overview')
}

export function fetchTimeseries(params: { app?: string; hours?: number; bucket?: string }) {
  const qs = new URLSearchParams()
  if (params.app) qs.set('app', params.app)
  if (params.hours) qs.set('hours', String(params.hours))
  if (params.bucket) qs.set('bucket', params.bucket)
  return apiFetch<TimeseriesPoint[]>(`/api/stats/timeseries?${qs.toString()}`)
}

export function fetchTopApps(hours = 24) {
  return apiFetch<TopApp[]>(`/api/stats/top-apps?hours=${hours}`)
}

export function fetchLevelCounts(hours = 24, app?: string) {
  const qs = new URLSearchParams({ hours: String(hours) })
  if (app) qs.set('app', app)
  return apiFetch<Record<string, number>>(`/api/stats/levels?${qs.toString()}`)
}

export function fetchAppHealth() {
  return apiFetch<AppHealth[]>('/api/health/apps')
}

export function fetchClusters(params: { hours?: number; app?: string; level?: string; min_count?: number; limit?: number }) {
  const qs = new URLSearchParams()
  if (params.hours) qs.set('hours', String(params.hours))
  if (params.app) qs.set('app', params.app)
  if (params.level) qs.set('level', params.level)
  if (params.min_count) qs.set('min_count', String(params.min_count))
  if (params.limit) qs.set('limit', String(params.limit))
  return apiFetch<LogCluster[]>(`/api/clusters?${qs.toString()}`)
}

export function fetchAnomalies() {
  return apiFetch<{ results: AnomalyResult[]; note: string }>('/api/anomalies')
}

export function fetchForecast(app?: string) {
  return apiFetch<Forecast>(`/api/forecast${app ? `?app=${encodeURIComponent(app)}` : ''}`)
}

export function listIncidents(status?: 'active' | IncidentStatus) {
  return apiFetch<Incident[]>(`/api/incidents${status ? `?status=${status}` : ''}`)
}

export function createIncident(input: { title: string; severity?: string; affected_apps?: string; summary?: string }) {
  return apiFetch<Incident>('/api/incidents', { method: 'POST', body: input })
}

export function updateIncident(id: number, updates: { status?: IncidentStatus; severity?: string; title?: string; summary?: string }) {
  return apiFetch<Incident>(`/api/incidents/${id}`, { method: 'PATCH', body: updates })
}

export function fetchIncidentAnalysis(id: number) {
  return apiFetch<CopilotAnalysis>(`/api/incidents/${id}/analysis`)
}

export function listAlertEvents(ruleId?: number) {
  return apiFetch<AlertEvent[]>(`/api/alerts/events${ruleId ? `?rule_id=${ruleId}` : ''}`)
}

export function parseAlertText(text: string) {
  return apiFetch<{ draft: ParsedAlertDraft; application_id: number | null }>('/api/alerts/parse', {
    method: 'POST',
    body: { text },
  })
}

// ---- Global search (command palette) ----

export interface SearchItem {
  id: string
  kind: 'log' | 'application' | 'incident' | 'doc'
  title: string
  subtitle: string
  /** App route for kinds on this SPA; docs-site path (prefix with DOCS_URL) for kind "doc". */
  href: string
  // Log entries carry the full fields because the log detail page renders
  // from navigation state rather than a per-log fetch.
  app_name?: string
  level?: string
  message?: string
  timestamp?: string
}

export interface SearchGroup {
  label: string
  items: SearchItem[]
}

export interface SearchResponse {
  query: string
  groups: SearchGroup[]
}

export function searchAll(q: string, signal?: AbortSignal) {
  return apiFetch<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`, { signal })
}