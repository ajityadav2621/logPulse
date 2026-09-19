# LogPulse

Centralized log monitoring: ingest, search, and stream application logs live —
with **AI-native insights** (clustering, anomaly detection, root-cause
analysis, forecasting), threshold **alerting with triage**, role-based auth
(email/password + Google/GitHub OAuth), and SDKs for Go, Node, and Python.

```
logpulse/
├── backend/           Go/Gin API, Postgres (auth/users) + Mongo (logs), WebSocket stream
│   └── internal/monitor/   AI-1..AI-8: clustering, anomalies, incidents, forecast, copilot
├── frontend/          React/Vite dashboard (dark/light, live charts)
├── sdk/               Go · Node/TypeScript · Python clients + framework middleware
├── deployment/        Docker Compose stack, nginx, env template, deploy script
└── docs/
    ├── DEPLOYMENT_GUIDE.md   how to run the stack (incl. free hosting)
    ├── SDK_GUIDE.md          SDK quickstarts, building, publishing, free deployment
    └── FRD.md                functional requirements + implementation status
```

## Architecture

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

## What's built

**Core (MVP)**

- Auth: email/password + Google/GitHub OAuth, JWT, role-based access, invite-only signup, admin bootstrap, audit log
- Log ingestion behind per-app API keys, live WebSocket stream, search & filter
- Applications registry, saved searches, custom dashboards, reports/exports, in-app notifications

**Advanced monitoring (AI-native, zero external APIs — see `docs/FRD.md` §4)**

- **AI-1 Clustering & dedup** — messages are fingerprinted at ingest; Analytics collapses near-duplicates into patterns with live counts ("15.6K lines → 19 patterns")
- **AI-2 Anomaly detection** — background sweep learns each app's hour-of-day volume/error baselines and flags z ≥ 3 deviations (spikes, error-rate surges, silent services) automatically
- **AI-4 Cross-service correlation** — anomalies co-occurring across services open ONE correlated incident
- **AI-5 Root-cause copilot** — per-incident analysis: timeline, dominant failure signatures, field hints, and ranked hypotheses with cited log-line evidence (suggestions, never auto-actions)
- **AI-6 Alert triage** — per-rule cooldowns suppress duplicate pages; alert events link to incidents
- **AI-7 Volume forecasting** — 24h forecast with confidence band, daily growth %, 30-day storage projection
- **AI-8 NL alert authoring** — "alert me when payments-api has more than 10 errors mentioning timeout within 5 minutes" → reviewed draft rule

**SDKs (see `docs/SDK_GUIDE.md`)**

- Go, Node/TypeScript, Python clients with async buffering + framework middleware (Gin, Express, FastAPI, Flask)

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

## Run it with Docker (recommended)

```bash
cd deployment
cp .env.example .env      # edit JWT_SECRET, POSTGRES_PASSWORD, SEED_ADMIN_PASSWORD
./scripts/deploy.sh       # add --edge for the single-entrypoint nginx
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:8080`
Full details, ports, and TLS: see `docs/DEPLOYMENT_GUIDE.md`.

## Run it locally without Docker (day-to-day dev)

```bash
# 1. databases only, with ports published to the host
cd deployment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres mongo

# 2. backend (reads env vars; there is no .env loader)
cd ../backend
export POSTGRES_DSN="host=127.0.0.1 user=logpulse password=... dbname=logpulse port=5432 sslmode=disable"
export MONGO_URI="mongodb://127.0.0.1:27017" MONGO_DB=logpulse JWT_SECRET=dev-secret
export FRONTEND_URL=http://localhost:5173 SEED_ADMIN_EMAIL=admin@logpulse.io SEED_ADMIN_PASSWORD=changeme123
go run ./cmd/server        # http://localhost:8080, check GET /health

# 2b. optional: seed a week of demo logs (clusters, anomalies, forecast data)
MONGO_URI=mongodb://127.0.0.1:27017 go run ./cmd/seeddev

# 3. frontend
cd ../frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api and /ws
```

> Windows + WSL2 tip: prefer `127.0.0.1` over `localhost` in DSNs — `localhost`
> may resolve to a WSL relay instead of Docker.

## Try it end to end

1. Log in at `/login` (bootstrap admin credentials are in your env,
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
2. Register an application (Applications page) and copy its API key.
3. Send a test log:
   ```bash
   curl -X POST http://localhost:8080/api/logs \
     -H "Authorization: Bearer <APPLICATION_API_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"app_name":"payments-api","level":"error","message":"failed to charge card"}'
   ```
4. Watch it appear live on the dashboard; check **Analytics** for clusters and
   forecasts, **System Health** for per-app status, and describe an alert in
   words on the **Alerts** page.

## What's next

See `docs/FRD.md` for the full requirement list and status: semantic search
(AI-3), OpenTelemetry ingestion, Java/.NET SDKs, and client-side PII scrubbing
are the remaining roadmap items.
