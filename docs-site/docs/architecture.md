# Architecture

LogPulse is a Go (Gin) REST + WebSocket API, a React/Vite SPA, PostgreSQL for
structured data (users, roles, incidents, alert events), and MongoDB for log
documents. The diagrams below are the same ones maintained in the project
README.

## System overview

```mermaid
graph TB
    Browser["Browser (React SPA)"]

    subgraph Edge["Edge (optional, --profile edge)"]
        Nginx["logpulse-nginx<br/>TLS + reverse proxy"]
    end

    subgraph App["Application containers"]
        Frontend["logpulse-frontend<br/>static SPA on :80"]
        API["logpulse-backend (Go/Gin)<br/>REST :8080"]
        Hub["WebSocket Hub<br/>/ws/logs"]
        Monitor["Background monitor<br/>anomaly sweep every N s"]
    end

    subgraph Data["Data stores"]
        PG[("PostgreSQL<br/>users, roles, audit,<br/>incidents, alert events")]
        Mongo[("MongoDB<br/>log documents + pattern fingerprints")]
    end

    ExtApp1["Your services<br/>(SDK / POST /api/logs)"]

    Browser -->|"HTTPS"| Nginx
    Nginx -->|"/api, /ws"| API
    Nginx -->|"/ (everything else)"| Frontend
    Browser -.->|"dev mode"| Frontend
    Browser -.->|"dev mode"| API

    API --> PG
    API --> Mongo
    API <--> Hub
    Hub -->|"live log push"| Browser
    Monitor -->|"incidents + notifications"| PG
    Monitor -->|"baselines, clusters"| Mongo

    ExtApp1 -->|"POST /api/logs (API key)"| API
```

## Auth flow (email/password + JWT)

```mermaid
sequenceDiagram
    participant U as Browser
    participant F as Frontend (SPA)
    participant A as Backend API
    participant P as PostgreSQL

    U->>F: Enter email + password
    F->>A: POST /api/auth/login
    A->>P: Verify credentials (hashed password)
    P-->>A: User record + role
    A-->>F: Signed JWT
    F-->>U: Store token, redirect to dashboard
    Note over U,A: Every request after this carries the token
    U->>F: Open a protected page
    F->>A: Request with Authorization: Bearer <JWT>
    A->>A: JWTAuth middleware validates signature + expiry
    A-->>F: Protected data (or 401 if invalid/expired)
```

## Auth flow (Google / GitHub OAuth)

```mermaid
sequenceDiagram
    participant U as Browser
    participant F as Frontend
    participant A as Backend API
    participant O as OAuth Provider
    participant P as PostgreSQL

    U->>F: Click "Sign in with Google/GitHub"
    F->>A: GET /api/auth/google/login
    A-->>U: 302 redirect to provider consent screen
    U->>O: Authenticate + approve
    O-->>A: GET /api/auth/google/callback?code=...
    A->>O: Exchange code for user profile
    O-->>A: Profile (email, name)
    A->>P: Find existing user, or create one
    A-->>U: Redirect to FRONTEND_URL/oauth-callback?token=<JWT>
    U->>F: Store token, land on dashboard
```

## Log ingestion & monitoring flow

```mermaid
sequenceDiagram
    participant App as Application (SDK)
    participant A as Backend API
    participant M as MongoDB
    participant H as WebSocket Hub
    participant D as Dashboard (Browser)
    participant Mon as Background monitor

    App->>A: POST /api/logs (API key) {app, level, message, meta}
    A->>A: Fingerprint message (AI-1)
    A->>M: Insert log document
    A->>H: Broadcast new entry
    H-->>D: Push over /ws/logs (live update)
    A->>Mon: Evaluate alert rules (async)
    Mon->>M: Baseline queries (hourly counts, clusters)
    Mon->>Mon: z-score vs same-hour baseline (AI-2)
    Mon->>D: Open/update incidents (AI-4) + notify admins

    D->>A: GET /api/clusters, /api/anomalies, /api/forecast
    A->>M: Aggregations
    M-->>A: Results
    A-->>D: Charts, patterns, forecasts
```

## Deployment topology (Docker Compose)

```mermaid
graph LR
    subgraph Host["Docker host"]
        subgraph Net["logpulse-net (bridge)"]
            PGc["postgres"]
            Mc["mongo"]
            Bc["logpulse-backend :8080"]
            Fc["logpulse-frontend :80"]
            Nc["logpulse-nginx :80/:443<br/>(optional edge)"]
        end
    end

    Browser(("Browser")) -->|"with --edge"| Nc
    Browser -.->|"without --edge"| Fc
    Browser -.->|"without --edge"| Bc
    Nc --> Bc
    Nc --> Fc
    Bc --> PGc
    Bc --> Mc
```

## Monitoring pipeline

The AI-native features live in `backend/internal/monitor/`. They are
deterministic — no external model calls, no data leaving the deployment.

| File | Responsibility |
|------|----------------|
| `fingerprint.go` | Normalizes a message into a pattern template (`<id>`, `<num>`, `<ip>`, `<uuid>`, `<url>`, `<str>`) and hashes it (AI-1) |
| `aggregate.go` | All Mongo aggregations: timeseries, top apps, clusters, per-app health, overview |
| `detector.go` | Baselines + z-score detection, incident upsert/correlation, background sweep loop (AI-2, AI-4, AI-6) |
| `forecast.go` | Linear trend + hour-of-day profile, 24h prediction with ±1.5σ band (AI-7) |
| `copilot.go` | Evidence-first incident analysis: timeline, signatures, field hints, hypotheses (AI-5) |
| `nlalert.go` | Plain-language → draft alert rule parser (AI-8) |

Detection details:

- **Baseline** — the last *complete* hour is compared against the same
  hour-of-day across the past 7 days, so daily rhythm doesn't cause false
  alarms. The in-progress hour is never scored.
- **Volume spike** — z ≥ 3 against the same-hour profile (std regularized
  because 7 samples is few), and observed ≥ max(5, 2× expected).
- **Error rate** — Wald z-test of the observed hour's error share against
  the pooled weekly rate; needs ≥ 20 logs in the hour.
- **Silence** — a precise raw count for the last 15 minutes; zero with a
  baseline that predicts real traffic flags a probable outage.
- **Correlation** — ≥ 2 apps anomalous in the same sweep → one incident
  listing all affected services, instead of separate pages.

All findings are *suggestions*: incidents are opened and updated, evidence is
stored and shown, but nothing is auto-resolved and no message is sent to a
human without a corresponding notification the operator can dismiss.

## Data model

| Store | Data |
|-------|------|
| PostgreSQL | `users`, `applications`, `alert_rules`, `alert_events`, `incidents`, `audit_logs`, `saved_searches`, `dashboards`, `dashboard_widgets`, `reports`, `notifications` |
| MongoDB | `logs` — one document per entry, with `pattern_hash` / `pattern` fields added at ingest |
