# LogPulse — Functional Requirements Document

Version 1.1 | Log Monitoring Platform
(Source of truth: `docs/FRD.docx`; this markdown mirrors it and marks
implementation status as of the Phase-2 delivery.)

## 1. Purpose & Scope

LogPulse is a centralized log monitoring platform: applications ship logs to
it, operators search and filter them, watch them arrive live, and get
proactively alerted and AI-assisted with root-cause analysis. This document
defines what the system must do — the MVP, the hardening work, the
advanced/AI-native phase, and the integration SDK — so engineering, QA, and
stakeholders share one reference for scope and priority.

Out of scope for this document: UI visual design, third-party pricing/vendor
selection, and infrastructure sizing (covered in `docs/DEPLOYMENT_GUIDE.md`).

## 2. Current System Overview

Backend: Go (Gin), REST API + WebSocket stream. Auth store: PostgreSQL
(users, roles, audit log). Log store: MongoDB (log documents). Frontend:
React/Vite SPA. Deployment: Docker Compose, source and deployment config kept
in separate top-level folders.

## 3. Functional Requirements

### 3.1 Authentication & Access Control — ✅ Implemented

| ID | Requirement | Description | Priority | Status |
|-----|-------------|-------------|----------|--------|
| FR-1.1 | Email/password login | Users authenticate with email + password; credentials stored hashed in Postgres. | Must | ✅ |
| FR-1.2 | OAuth login | Login via Google and GitHub OAuth as an alternative to password login. | Must | ✅ |
| FR-1.3 | JWT session | Successful login issues a signed JWT; protected routes validate it via middleware. | Must | ✅ |
| FR-1.4 | Role-based access | Roles (admin/editor/viewer) gate admin-only routes (`/api/admin/*`). | Must | ✅ |
| FR-1.5 | Invite-only signup | No public self-signup; admins create/invite users; invite acceptance sets the password. | Must | ✅ |
| FR-1.6 | Bootstrap admin | On first run with zero users, a seed admin account is created from env config. | Must | ✅ |
| FR-1.7 | Audit log | Admin actions (user create/deactivate/role change) are recorded and listable. | Should | ✅ |

### 3.2 Log Ingestion & Streaming — ✅ Implemented

| ID | Requirement | Description | Priority | Status |
|-----|-------------|-------------|----------|--------|
| FR-2.1 | Ingest endpoint | `POST /api/logs` accepts a log document (app name, level, message, metadata) and stores it in MongoDB. | Must | ✅ (API-key protected) |
| FR-2.2 | Live stream | `GET /ws/logs` pushes newly ingested log entries to connected dashboard clients in real time. | Must | ✅ |
| FR-2.3 | Search & filter | Authenticated users can query stored logs by application, level, and free-text keyword. | Must | ✅ |
| FR-2.4 | Log details view | A single log entry can be opened to see its full payload/metadata. | Should | ✅ |

### 3.3 Administration

| ID | Requirement | Description | Priority | Status |
|-----|-------------|-------------|----------|--------|
| FR-3.1 | User management | Admins list, create, deactivate/reactivate users and change roles. | Must | ✅ |
| FR-3.2 | Server/application registry | Track which applications/servers are sending logs. | Should | ✅ (Applications registry + live System Health view) |
| FR-3.3 | Notifications | In-app notification center for account and system events. | Could | ✅ |

### 3.4 Near-term Hardening

| ID | Requirement | Description | Priority | Status |
|-----|-------------|-------------|----------|--------|
| FR-4.1 | Per-application API keys | Ingestion is authenticated and attributable via a scoped API key per application. | Must | ✅ |
| FR-4.2 | Alert rules | Threshold-based alerts ("5 errors in 60s for app X") triggering notification. | Must | ✅ (in-app + optional generic webhook; cooldown triage) |
| FR-4.3 | Saved searches & dashboards | Users save a filter combination and revisit it; dashboards surface results as widgets. | Should | ✅ |
| FR-4.4 | Reports/export | On-demand export of filtered log sets (CSV/PDF). | Could | ✅ |

## 4. Phase 2 — Advanced & AI-Native Features

These move LogPulse from "store and search logs" to "understand and act on
logs." Implemented in `backend/internal/monitor` without any external LLM
dependency — every feature is deterministic, free to run, and keeps all data
inside the deployment.

| ID | Feature | Description | Depends on | Status |
|-----|---------|-------------|------------|--------|
| AI-1 | Log clustering & deduplication | Every ingested message is fingerprinted (variables → `<id>`/`<num>`/`<ip>`/`<uuid>` placeholders, SHA-256 hash) and near-duplicates group into one pattern with a live count. Analytics shows "N log lines collapsed into M patterns". | FR-2.1 | ✅ |
| AI-2 | Anomaly detection | Per-app baselines over 7 days of hourly counts; the last complete hour is z-scored against the *same hour-of-day* profile (volume) and a pooled Wald z-test (error rate). A precise 15-minute raw count catches silent services. Runs automatically on a background sweep (`ANOMALY_INTERVAL_SECONDS`). | AI-1 | ✅ |
| AI-3 | Semantic / natural-language search | Embeddings-based search over log content. | FR-2.3 | ⏳ Future |
| AI-4 | Cross-service correlation | Anomalies from multiple applications flagged in the same sweep are grouped into ONE correlated incident listing affected services. | AI-2 | ✅ |
| AI-5 | AI root-cause copilot | Given an incident: timeline, dominant failure signatures, structured-field hints (e.g. one host in 90% of errors), and ranked hypotheses — each citing the actual log lines used. Heuristic, evidence-first, and explicitly labelled a suggestion. | AI-1, AI-4 | ✅ (heuristic engine; an LLM enhancer can be layered on later) |
| AI-6 | Alert triage & noise reduction | Per-rule cooldown windows: repeat breaches are recorded as *suppressed* alert events instead of re-notifying; unresolved alert events attach to open incidents so on-call sees one story. | AI-2, AI-4, FR-4.2 | ✅ |
| AI-7 | Capacity/volume forecasting | Linear trend + hour-of-day profile predicts the next 24h per app with a ±1.5σ band; projects daily growth % and 30-day storage needs (document sizes measured via `$bsonSize`). | AI-1 | ✅ |
| AI-8 | Natural-language alert authoring | "Alert me when payments-api has more than 5 errors mentioning timeout within 2 minutes" compiles into a draft rule (deterministic parser) that the user reviews before activation. | FR-4.2 | ✅ (deterministic parser; LLM enhancer optional) |

**Non-functional note (kept from FRD 1.0):** every AI-generated conclusion
shows its evidence and remains a suggestion an operator confirms — nothing
pages a human or closes an incident silently.

## 5. Phase 3 — SDK Development

| Phase | Milestone | Status |
|-------|-----------|--------|
| 1 | Core client (Go, Node, Python) — structured JSON matching the log document shape | ✅ |
| 2 | Reliability layer — async batching, memory buffering, best-effort delivery | ✅ |
| 3 | Auto-instrumentation — Express, FastAPI, Flask, Gin middleware | ✅ |
| 4 | OpenTelemetry compatibility (OTLP ingestion, trace-ID correlation) | ⏳ Future |
| 5 | Additional languages (Java, .NET) | ⏳ Future |
| 6 | SDK-side AI hooks (client-side redaction/PII scrubbing, field enrichment) | ⏳ Future |

See `docs/SDK_GUIDE.md` for quickstarts, building, publishing, and free
deployment of the whole stack.

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Ingestion accepts bursts without blocking the caller; p95 ingest latency target < 100ms under normal load. |
| Scalability | Backend stays stateless; the WebSocket hub needs a shared pub/sub (e.g. Redis) before multi-replica deployment. |
| Security | Secrets only via environment variables; ingest behind API keys. |
| Availability | Postgres and Mongo have health checks; backend restarts automatically (`restart: unless-stopped`). |
| Observability | `/health` endpoint, container health checks, LogPulse-on-LogPulse for its own error logs. |
| Data retention | Log retention window remains an open decision — see §7. |

## 7. Assumptions, Constraints & Open Questions

- Single-tenant deployment per organization (no cross-tenant isolation yet).
- MongoDB regex search is acceptable at current volume; migrate to
  OpenSearch/Elasticsearch when it isn't.
- Open: log retention window and archival strategy (TTL index recommended).
- Open: which LLM provider backs optional AI enhancements — the shipped
  Phase-2 features deliberately need none.

## 8. Document Control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | Draft | Initial FRD covering MVP, hardening, AI roadmap, SDK phases. |
| 1.1 | 2026-09 | Markdown mirror added; implementation status updated after Phase-2 delivery. |
