# LogPulse — Deployment Guide

## Layout

```
logpulse/
├── backend/                # Go/Gin API — source + its own Dockerfile
├── frontend/                # React/Vite SPA — source + its own Dockerfile
├── deployment/               # Everything needed to run the stack, nothing else
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── nginx/nginx.conf      # edge reverse proxy (optional "edge" profile)
│   └── scripts/deploy.sh
└── docs/
    └── DEPLOYMENT_GUIDE.md   # this file
```

Source code (`backend/`, `frontend/`) and deployment config (`deployment/`)
are kept separate on purpose: application developers work in the first two
without touching orchestration, and ops changes (ports, TLS, scaling) live
entirely in `deployment/` without needing a code change.

## Quick start (local / single host)

```bash
cd deployment
cp .env.example .env
# edit .env: JWT_SECRET, POSTGRES_PASSWORD, SEED_ADMIN_PASSWORD at minimum
./scripts/deploy.sh
```

This builds `logpulse-backend` and `logpulse-frontend` images from their
respective Dockerfiles and starts:

| Service            | Purpose                              | Default port |
|---------------------|---------------------------------------|---------------|
| postgres             | users, roles, audit log               | internal only |
| mongo                | raw log documents                     | internal only |
| logpulse-backend     | REST API + `/ws/logs` websocket       | 8080          |
| logpulse-frontend    | built SPA served by its own nginx     | 5173          |

Auth (email/password + Google/GitHub OAuth, JWT, admin bootstrap) is
unchanged from the current codebase — no backend logic was touched, only how
it's built and started.

## With a single public entrypoint

```bash
./scripts/deploy.sh --edge
```

Also starts `logpulse-nginx` (`deployment/nginx/nginx.conf`) on port 80,
which reverse-proxies `/api` and `/ws` to the backend and everything else to
the frontend, so the whole app is reachable on one origin/port. Enable the
commented-out HTTPS server block once real certs are mounted under
`deployment/nginx/certs/`.

## Environment variables

All of them are documented inline in `deployment/.env.example`. The backend
container receives them directly (see the `environment:` block in
`docker-compose.yml`) — they map 1:1 onto `backend/internal/config/config.go`.

Advanced-monitoring knobs:

| Variable | Default | Purpose |
|----------|---------|---------|
| `ALERT_WEBHOOK_URL` | empty | POST fired alerts to any JSON endpoint (Slack/Discord/n8n). Empty = in-app only. |
| `ANOMALY_INTERVAL_SECONDS` | `120` | Pause between background anomaly sweeps (AI-2). Findings persist as incidents. |

## Local development against the containers

The production compose keeps database ports network-internal on purpose. To
run the backend/frontend on your host against containerized databases, use
the dev override (also documented in the README):

```bash
cd deployment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres mongo
```

This publishes Postgres on `5432` and Mongo on `27017` (override with
`POSTGRES_HOST_PORT` / `MONGO_HOST_PORT`). Then run the backend and frontend
from source as shown in the README. Do **not** include the override file in
production deployments.

To explore the AI features with realistic data, seed a week of synthetic logs
(fingerprints included, so clustering/anomalies/forecast light up):

```bash
cd backend
MONGO_URI=mongodb://127.0.0.1:27017 MONGO_DB=logpulse go run ./cmd/seeddev
```

## Rebuilding after a code change

```bash
cd deployment
docker compose up -d --build logpulse-backend    # backend only
docker compose up -d --build logpulse-frontend   # frontend only
```

## Notes for scaling beyond one host later

- `logpulse-backend` is stateless (JWT auth, no in-memory session), so it can
  be replicated behind the edge nginx once log volume needs it — the one
  thing to watch is the `/ws/logs` hub, which is currently in-process; a
  multi-replica setup will need a shared pub/sub (Redis or NATS) for the hub
  to fan out writes to all replicas' websocket clients. The background
  anomaly sweep also runs in-process; with multiple replicas, move it behind
  a lock (or run it in exactly one replica) to avoid duplicate incidents.
- Postgres and Mongo are single-instance here; for production, point
  `POSTGRES_DSN` / `MONGO_URI` at managed/clustered instances instead of the
  bundled containers.
- Free-tier hosting options (Oracle Cloud Always Free, Fly.io/Render/Koyeb +
  Neon/Supabase + Atlas M0) are covered in `docs/SDK_GUIDE.md` §7.
