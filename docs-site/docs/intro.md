# Overview

LogPulse is a centralized log monitoring platform. Applications ship logs to
it over HTTP, operators watch them arrive live, search and filter them, and
get alerted — with an AI layer that groups duplicates, flags anomalies,
correlates cross-service incidents, and drafts root-cause analyses.

Everything runs in two containers plus two databases. No external AI APIs are
used: every "AI" feature is deterministic and runs inside your deployment.

## At a glance

| Area | What you get | Where to read |
|------|--------------|---------------|
| Ingest | `POST /api/logs` behind per-app API keys | [First logs](/docs/getting-started/first-logs) |
| Live stream | WebSocket push to every open dashboard | [WebSocket protocol](/docs/websocket-protocol) |
| Search | Filter by app, level, keyword (Mongo) | [API reference](/docs/api-reference) |
| Clustering (AI-1) | Near-duplicate lines → normalized patterns with counts | [Architecture](/docs/architecture) |
| Anomaly detection (AI-2) | Hour-of-day baselines, z-score flagging | [Architecture](/docs/architecture) |
| Incidents (AI-4/5) | Correlated cross-service incidents + root-cause copilot | [Architecture](/docs/architecture) |
| Alerting (FR-4.2, AI-6/8) | Threshold rules, cooldown triage, NL authoring | [API reference](/docs/api-reference) |
| Forecasting (AI-7) | 24h volume projection, growth %, storage estimate | [API reference](/docs/api-reference) |
| SDKs | Go, Node/TypeScript, Python clients + middleware | [SDKs](/docs/sdks) |
| Auth | Email/password + Google/GitHub OAuth, JWT, roles | [Architecture](/docs/architecture) |

## The stack

| Layer | Technology |
|-------|------------|
| Backend | Go (Gin), REST + WebSocket |
| Auth store | PostgreSQL (users, roles, audit log, incidents, alert events) |
| Log store | MongoDB (log documents + pattern fingerprints) |
| Frontend | React/Vite SPA |
| Docs | Docusaurus (this site) |
| Deployment | Docker Compose, optional edge nginx |

## Doc map

New here? Read in this order:

1. [Installation](/docs/getting-started/installation) — run the stack
2. [First logs](/docs/getting-started/first-logs) — send data, see it live
3. [Architecture](/docs/architecture) — how the pieces fit
4. [API reference](/api-reference) — every endpoint, interactive
5. [Configuration](/docs/configuration) — every environment variable

Something broken? Check [Troubleshooting / FAQ](/docs/troubleshooting).
