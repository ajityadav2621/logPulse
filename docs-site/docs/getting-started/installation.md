# Installation

## Prerequisites

| Tool | Version | Needed for |
|------|---------|------------|
| Docker + Docker Compose | any recent | databases, full stack |
| Go | 1.25+ | running the backend from source |
| Node.js | 18+ | frontend, docs site, Node SDK |
| Python | 3.9+ | Python SDK (optional) |

## Option A — full stack with Docker (recommended)

```bash
cd deployment
cp .env.example .env
# edit .env: JWT_SECRET, POSTGRES_PASSWORD, SEED_ADMIN_PASSWORD at minimum
./scripts/deploy.sh        # add --edge for the single-entrypoint nginx
```

| Service | URL / port |
|---------|------------|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| Health check | http://localhost:8080/health |
| Postgres / Mongo | network-internal (no published ports in prod compose) |

First boot creates the bootstrap admin from `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` in your `.env`.

## Option B — databases in Docker, code on the host

Day-to-day development against containerized databases:

```bash
cd deployment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres mongo
```

The dev override publishes Postgres on `5432` and Mongo on `27017`. Do not
use the override file in production.

Then run the backend (it reads plain environment variables — there is no
`.env` loader):

```bash
cd backend
export POSTGRES_DSN="host=127.0.0.1 user=logpulse password=... dbname=logpulse port=5432 sslmode=disable"
export MONGO_URI="mongodb://127.0.0.1:27017" MONGO_DB=logpulse
export JWT_SECRET=dev-secret
export FRONTEND_URL=http://localhost:5173
export SEED_ADMIN_EMAIL=admin@logpulse.io SEED_ADMIN_PASSWORD=changeme123
go run ./cmd/server
```

And the frontend:

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="pkg-manager" defaultValue="npm">
<TabItem value="npm" label="npm">

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, proxies /api and /ws to :8080
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
cd frontend
pnpm install
pnpm run dev    # http://localhost:5173, proxies /api and /ws to :8080
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
cd frontend
yarn install
yarn dev        # http://localhost:5173, proxies /api and /ws to :8080
```

</TabItem>
</Tabs>

:::note Windows + WSL2
Use `127.0.0.1` instead of `localhost` in DSNs. On many Windows setups
`localhost` resolves to the WSL relay first, which may point at a different
service than your Docker container.
:::

## Seed demo data (optional)

A week of realistic synthetic logs — enough to light up clustering, anomaly
detection, and forecasting:

```bash
cd backend
MONGO_URI=mongodb://127.0.0.1:27017 MONGO_DB=logpulse go run ./cmd/seeddev
```

Add `-force` to re-seed over existing data.

## Verify

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

Next: [send your first logs](/docs/getting-started/first-logs).
