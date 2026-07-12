# logPulse - Building......InProgress
Everything here runs free/local, no cloud accounts needed. Track all your logs at logPulse with efficiency and proficiently.
=======
# LogPulse — MVP setup

Everything here runs free/local, no cloud accounts needed.

## 1. Start the databases

```bash
docker compose up -d
```

This starts Postgres (`localhost:5432`) and MongoDB (`localhost:27017`).

## 2. Run the backend

```bash
cd backend
cp .env.example .env
go mod tidy
go run ./cmd/server
```

Server starts on `http://localhost:8080`. Check `GET /health`.

## 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`, proxying `/api` and `/ws` to the Go backend.

## 4. Try it end to end

1. Sign up at `/login`.
2. Send a test log:
   ```bash
   curl -X POST http://localhost:8080/api/logs \
     -H "Content-Type: application/json" \
     -d '{"app_name":"payments-api","level":"error","message":"failed to charge card"}'
   ```
3. Watch it appear live on the dashboard.
4. Use the filter bar to search by app/level/keyword.

## What's built (MVP, 4 features)

- [x] JWT auth (signup/login) — Postgres
- [x] Log ingestion endpoint — MongoDB
- [x] Live log stream — WebSocket hub
- [x] Search/filter — MongoDB query on app/level/keyword

## What's next (v2, once MVP works)

- Alert rules (threshold-based, e.g. "5 errors in 60s") + email/Slack notification
- API keys per application instead of open ingest endpoint
- Dashboards/saved searches
- Swap MongoDB regex search for Elasticsearch/OpenSearch once volume grows
