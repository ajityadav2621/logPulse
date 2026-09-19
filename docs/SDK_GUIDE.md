# LogPulse SDK Guide

Everything you need to integrate an application with LogPulse, build the SDKs
locally, publish them for free, and run the whole LogPulse stack on free-tier
infrastructure.

```
sdk/
├── node/      @logpulse/sdk-node   TypeScript, zero runtime deps (express extra is dev-only)
├── python/    logpulse-sdk         Pure stdlib (FastAPI/Flask extras optional)
└── go/        github.com/logpulse/logpulse-go  (gin middleware optional)
```

---

## 1. How integration works

1. **Register the application** in LogPulse (Applications page, or
   `POST /api/applications`). Each application gets a **per-app API key** —
   ingest is authenticated and attributable (FR-4.1).
2. **Initialize the SDK once** at process startup with that key.
3. **Replace ad-hoc logging** with structured calls:
   `log.error("payment failed", {order_id, user_id})`. Fields become
   **queryable metadata**, not text buried in a message.
4. Optionally drop in the **framework middleware** for automatic request,
   latency, and error capture — no per-route code.

Logs ship to `POST /api/logs`, appear live on the dashboard over WebSocket,
and immediately power search, clustering, anomaly detection, and alerting —
no extra setup.

---

## 2. Getting an API key

In the LogPulse UI: **Applications → Register Application → copy the API key**
(a date-prefixed 64-hex bearer token). Keys are generated with `crypto/rand`
and stored on the application record; treat them like passwords.

---

## 3. Quickstarts

### 3.1 Node.js / TypeScript

```bash
cd sdk/node && npm install && npm run build
npm install <path-or-registry-package>   # see §5 for publishing
```

```ts
import { LogPulseClient } from '@logpulse/sdk-node'

const client = new LogPulseClient('YOUR_API_KEY', 'payments-api', {
  baseURL: 'http://your-logpulse-host:8080',
  bufferSize: 100,      // entries buffered before an early flush
  flushInterval: 5000,  // ms between background flushes
})

client.info('charge initiated', { order_id: 'ORD-1', user_id: 42 })
client.warn('card gateway slow', { latency_ms: 2400 })
client.error('charge failed', { order_id: 'ORD-1', code: 'declined' })

// on shutdown — flush whatever is buffered
process.on('SIGINT', async () => {
  await client.close()
  process.exit(0)
})
```

Express middleware (auto request/latency/error capture):

```ts
import express from 'express'
import { expressMiddleware } from '@logpulse/sdk-node'

const app = express()
app.use(express.json())
app.use(expressMiddleware(client)) // ≥500 → error, ≥400 → warn, else info
```

A runnable server lives in `sdk/node/example/index.ts` (`npm run example`).

### 3.2 Python

```bash
cd sdk/python
pip install -e .            # add extras: pip install -e ".[fastapi]" or ".[flask]"
```

```python
from logpulse import LogPulseClient

client = LogPulseClient(
    api_key="YOUR_API_KEY",
    app_name="payments-api",
    base_url="http://your-logpulse-host:8080",
    buffer_size=100,
    flush_interval=5,       # seconds; a background thread flushes continuously
)

client.info("charge initiated", {"order_id": "ORD-1", "user_id": 42})
client.error("charge failed", {"order_id": "ORD-1", "code": "declined"})

client.close()  # flush + stop the flusher thread
```

Framework middleware:

```python
# FastAPI
from fastapi import FastAPI
from logpulse import LogPulseClient
from logpulse.middleware.fastapi import fastapi_middleware

client = LogPulseClient("YOUR_API_KEY", "payments-api")
app = FastAPI()
app.middleware("http")(fastapi_middleware(client))

# Flask
from logpulse.middleware.flask import flask_middleware
app.wsgi_app = flask_middleware(client, app.wsgi_app)
```

A runnable FastAPI example is in `sdk/python/example/app.py`.

### 3.3 Go

```bash
cd sdk/go
go get github.com/logpulse/logpulse-go
```

```go
import logpulse "github.com/logpulse/logpulse-go"

client := logpulse.New("YOUR_API_KEY", "payments-api")
defer client.Close()

client.Info("charge initiated", map[string]interface{}{"order_id": "ORD-1"})
client.Error("charge failed", map[string]interface{}{"code": "declined"})
```

Gin middleware:

```go
import "github.com/logpulse/logpulse-go/middleware"

r := gin.Default()
r.Use(middleware.Gin(client)) // ≥500 → error, ≥400 → warn, else info
```

A runnable server is in `sdk/go/example/main.go`.

### 3.4 No SDK? Raw HTTP works too

The wire contract is one JSON document — any language can ship logs with a
plain HTTP POST:

```bash
curl -X POST http://your-logpulse-host:8080/api/logs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"app_name":"payments-api","level":"error","message":"failed to charge card","meta":{"order_id":"ORD-1"}}'
```

`level` accepts `info | warning | error | critical | debug` (normalized
server-side). `meta` is free-form JSON and becomes filterable evidence in the
root-cause analysis.

---

## 4. Reliability model (what happens on failure)

All three SDKs share the same design so a LogPulse outage **never blocks or
crashes your application**:

| Mechanism     | Behaviour                                                                    |
|---------------|------------------------------------------------------------------------------|
| Buffering     | Entries queue in memory (default 100).                                       |
| Async flush   | Background flusher ships batches every `flushInterval`.                      |
| Overflow      | Oldest-space policy: when full, entries send immediately (best effort).      |
| Send failure  | Logged to stderr/console, never thrown into your request path.               |
| Shutdown      | `close()` / `client.Close()` flushes the buffer before exit.                 |

Tuning tips: high-traffic services → larger `bufferSize`, 2–5s flush; CLIs and
serverless → call `close()` in a `finally`/`SIGTERM` handler so nothing is
lost.

---

## 5. Building the SDKs

Prerequisites: Node 18+, Go 1.21+, Python 3.9+.

```bash
# Node — type-check + emit dist/
cd sdk/node
npm install
npm run build          # tsc → dist/
npm run example        # runs the Express example against localhost:8080

# Python
cd sdk/python
pip install build pytest
python -m build        # sdist + wheel in dist/
pip install -e . && python example/app.py

# Go
cd sdk/go
go build ./...         # compile
go vet ./...
go run ./example       # runs the example against localhost:8080
```

CI idea (GitHub Actions, free on public repos): one workflow that runs the
three build blocks above on every push — the LogPulse repo layout makes each
SDK an independent job.

---

## 6. Publishing for free

All three ecosystems can publish at zero cost. Use **GitHub Actions** to
publish on tagged releases (`v1.2.3` → all three registries).

### npm (Node)

```bash
cd sdk/node
npm version patch          # or minor/major
npm publish --access public
```

- Free account at npmjs.com. Scoped packages (`@logpulse/sdk-node`) need
  `--access public`.
- For private distribution, use **GitHub Packages** instead (free for public
  repos; storage included free for private ones within limits) — publish with
  `npm publish --registry=https://npm.pkg.github.com`.

### PyPI (Python)

```bash
cd sdk/python
python -m build
pip install twine
twine upload dist/*        # free account + API token at pypi.org
```

Trusted publishing (OIDC from GitHub Actions) is supported by PyPI and needs
no tokens at all.

### Go

Go modules need **no registry**: publish by pushing a git tag.

```bash
cd sdk/go
git tag v1.0.0 && git push origin v1.0.0
```

Consumers then run `go get github.com/logpulse/logpulse-go@v1.0.0`. To make
the module importable from a `sdk/go` subdirectory instead of the repo root,
add a `//` redirect via go.mod in the root or keep the module path pointing at
the subdirectory (`github.com/<org>/<repo>/sdk/go` also works without any
redirect).

### Versioning

Keep the three SDKs versioned in lockstep with the backend's wire contract.
The contract (`POST /api/logs` document shape) is additive-only: new optional
fields never break old SDKs.

---

## 7. Deploying LogPulse itself — for free

LogPulse is two stateless containers (Go API, static SPA) plus two databases.
Everything has a genuine free tier:

### Option A — single free VPS (recommended, everything in one place)

**Oracle Cloud Always Free** gives 4 ARM OCPUs + 24 GB RAM — enough for
LogPulse *and* your other side projects, with real public IP.

```bash
ssh ubuntu@your-vps
git clone <your-fork> && cd logpulse/deployment
cp .env.example .env       # set JWT_SECRET, POSTGRES_PASSWORD, SEED_ADMIN_PASSWORD
./scripts/deploy.sh --edge # postgres+mongo+backend+frontend+nginx, internal DBs
```

- TLS: point a free Cloudflare DNS record at the VPS and enable the HTTPS
  block in `nginx/nginx.conf` with Let's Encrypt certs (free, `certbot`).
- Backups: a nightly `docker exec … pg_dump` + `mongodump` cron to object
  storage (Cloudflare R2 free tier: 10 GB).

### Option B — PaaS free tiers (no VPS to manage)

| Piece      | Free hosting                          | Notes                                   |
|------------|----------------------------------------|-----------------------------------------|
| Backend    | Fly.io, Koyeb, Render free tier        | Deploy the `backend/` Dockerfile        |
| Frontend   | Cloudflare Pages, Vercel, Netlify      | Build `frontend/`, set `VITE_API_URL`   |
| Postgres   | Neon, Supabase, Aiven free tiers       | Set `POSTGRES_DSN` accordingly          |
| MongoDB    | MongoDB Atlas M0 (512 MB, permanent)   | Set `MONGO_URI` to the SRV string       |

Notes for Option B:

1. The backend is stateless — free-tier sleep/restarts are harmless (the SDKs
   buffer on the client during restarts).
2. Set `FRONTEND_URL` to the Pages/Vercel URL (CORS + OAuth redirect) and the
   OAuth provider redirect URLs to `https://<api-host>/api/auth/<provider>/callback`.
3. Fly.io example:

   ```bash
   fly launch --dockerfile backend/Dockerfile --name logpulse-api
   fly secrets set JWT_SECRET=… POSTGRES_DSN="…" MONGO_URI="…" FRONTEND_URL="…"
   ```

### Option C — homelab / WSL / Raspberry Pi

The compose stack runs anywhere Docker does. For LAN-only use, skip TLS and
use the plain deploy script; expose only `logpulse-frontend` and
`logpulse-backend` ports to the LAN.

### Sizing reality check

- The MVP comfortably handles millions of documents per app on 1 vCPU/1 GB.
- Enable the MongoDB TTL index on `logs.timestamp` (e.g. 30 days) once volume
  grows — retention is currently an open FRD question, so the stack ships
  without an expiry by default.
- Horizontal scaling of the backend needs a shared WebSocket pub/sub (Redis)
  before running multiple replicas — a documented FRD non-functional note.

---

## 8. Troubleshooting

| Symptom                          | Likely cause / fix                                                       |
|----------------------------------|---------------------------------------------------------------------------|
| `401 invalid api key`            | Key from a different environment, or app deleted — re-register.           |
| Logs not appearing live          | WebSocket blocked — serve via the edge nginx (`--edge`) or check `/ws/logs` proxying. |
| Dashboard empty but ingest works | Wrong `VITE_API_URL` baked into the frontend build — rebuild the image.   |
| SDK logs lost on shutdown        | `close()` not called — add a SIGTERM/SIGINT handler.                      |
| CORS errors in browser           | `FRONTEND_URL` doesn't match the SPA origin — set it and restart.         |
