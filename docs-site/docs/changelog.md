# Changelog

Versions follow the FRD (`docs/FRD.md`) milestones.

## 1.1 — AI-native monitoring, modern dashboard, SDKs, docs site

**Advanced monitoring (FRD §4 — all deterministic, no external AI APIs)**

- AI-1 clustering & dedup: messages fingerprinted at ingest; near-duplicates
  collapse into normalized patterns with live counts
- AI-2 anomaly detection: background sweep z-scores each app's last complete
  hour against its same-hour-of-day 7-day baseline; silent-service detection
- AI-4 cross-service correlation: co-occurring anomalies open one incident
  listing all affected services, deduplicated across sweeps
- AI-5 root-cause copilot: per-incident timeline, failure signatures,
  field hints, and ranked hypotheses citing actual log lines
- AI-6 alert triage: per-rule cooldowns suppress duplicate pages; alert
  events link into incidents; trigger history endpoint
- AI-7 volume forecasting: 24h projection with ±1.5σ band, growth %, and a
  30-day storage estimate measured from real document sizes
- AI-8 natural-language alert authoring with human review before activation

**Platform**

- Per-application API keys for ingest (crypto/rand); alert webhooks
  (`ALERT_WEBHOOK_URL`) alongside in-app notifications
- New stats endpoints: overview, timeseries, top-apps, levels, per-app health
- Incident lifecycle API (declare, acknowledge, resolve, analyze)
- Security fixes: unpredictable API-key generation, alert-rule query
  no longer breaks on preload, async alert evaluation uses a live context
- Dashboard, Analytics, Incidents, Alerts, and System Health pages rebuilt
  with live data, charts, dark/light themes
- SDKs: Go, Node/TypeScript, Python clients with buffering + Gin, Express,
  FastAPI, Flask middleware
- Demo seeder (`cmd/seeddev`) and dev compose override for local databases
- This documentation site (Docusaurus + Redoc + Mermaid)

**Remaining roadmap**: semantic search (AI-3), OpenTelemetry ingestion,
Java/.NET SDKs, client-side PII scrubbing.

## 1.0 — MVP

- Email/password + Google/GitHub OAuth, JWT sessions, roles
  (admin/editor/viewer), invite-only signup, bootstrap admin, audit log
- Log ingestion into MongoDB, live WebSocket stream, search & filter
- Applications registry, saved searches, custom dashboards, reports (CSV
  export), in-app notifications
- Docker Compose deployment with separable edge nginx
