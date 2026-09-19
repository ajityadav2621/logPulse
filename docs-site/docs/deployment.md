# Deployment

Adapted from `docs/DEPLOYMENT_GUIDE.md` in the repo — the full guide lives
there; this page is the operating summary.

## Quick start (single host)

```bash
cd deployment
cp .env.example .env      # set JWT_SECRET, POSTGRES_PASSWORD, SEED_ADMIN_PASSWORD
./scripts/deploy.sh
```

Builds `logpulse-backend` and `logpulse-frontend` from their Dockerfiles and
starts Postgres + Mongo on an internal network. Databases are **not** exposed
to the host in the production compose.

| Service | Purpose | Port |
|---------|---------|------|
| `logpulse-backend` | REST API + `/ws/logs` | 8080 |
| `logpulse-frontend` | Built SPA on its own nginx | 5173 |
| `postgres` | Users, roles, incidents, alert events | internal |
| `mongo` | Log documents | internal |

## Single public entrypoint

```bash
./scripts/deploy.sh --edge
```

Adds `logpulse-nginx` on port 80, reverse-proxying `/api` and `/ws` to the
backend and everything else to the frontend. Enable the commented HTTPS block
in `nginx/nginx.conf` once certs are mounted under `deployment/nginx/certs/`
(Let's Encrypt/`certbot` is the free path).

## Local development

The dev override publishes the database ports so you can run backend and
frontend from source:

```bash
cd deployment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres mongo
```

Never ship the override: production keeps the databases network-internal.

## Rebuilding after a code change

```bash
cd deployment
docker compose up -d --build logpulse-backend    # backend only
docker compose up -d --build logpulse-frontend   # frontend only
```

## This docs site

```bash
cd docs-site
npm install
npm run build     # static output in build/ — serve anywhere
npm run dev       # live-reload dev server on http://localhost:3001
```

`build/` is plain static HTML/JS/CSS — host it on GitHub Pages, Cloudflare
Pages, Netlify, or Vercel for free. Set `url`/`baseUrl` in
`docusaurus.config.js` for your real domain first.

## Free hosting options

Covered in depth in `docs/SDK_GUIDE.md` §7:

| Option | Pieces |
|--------|--------|
| Single free VPS (Oracle Cloud Always Free) | whole compose stack + edge nginx |
| PaaS free tiers (Fly.io / Render / Koyeb) | backend + frontend containers |
| Managed DBs free tiers (Neon / Supabase / Atlas M0) | Postgres + Mongo |

The backend is stateless — free-tier restarts are harmless because the SDKs
buffer on the client side.

## Scaling notes

- **Multiple backend replicas**: the WebSocket hub is in-process, so each
  replica only pushes to its own clients. Fan-out to all replicas needs a
  shared pub/sub (Redis or NATS) — a documented FRD non-functional item.
- **Background monitor**: the anomaly sweep also runs in-process; with
  multiple replicas, run it in exactly one replica (or behind a lock) to
  avoid duplicate incidents.
- **Databases**: the bundled single instances are fine to start; point
  `POSTGRES_DSN` / `MONGO_URI` at managed offerings when you outgrow them.
- **Retention**: no TTL is configured on the `logs` collection — an open FRD
  question. Add a TTL index on `timestamp` (e.g. 30 days) once volume grows.
