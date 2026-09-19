# API Reference

The full OpenAPI 3.0 spec is rendered interactively at
**[API Reference →](/api-reference)** (Redoc). The spec file lives at
`docs-site/openapi.yaml` and is generated from the route registrations in
`backend/cmd/server/main.go` — it is not hand-maintained prose.

This page covers the things the spec can't show: how the three auth realms
work and a few call recipes.

## Authentication realms

| Realm | Mechanism | Scope |
|-------|-----------|-------|
| Dashboard JWT | `Authorization: Bearer <jwt>` | Everything under `/api/**` except ingest |
| Ingest API key | `Authorization: Bearer <application API key>` | `POST /api/logs` only |
| OAuth | Browser 302 flow | `/api/auth/google/*`, `/api/auth/github/*` |

JWT facts (from `backend/internal/auth/auth.go`): HS256, 24-hour expiry,
claims `user_id`, `email`, `role` (`admin` / `editor` / `viewer`). There is
**no refresh endpoint** — sign in again after expiry.
{/* TODO(human): confirm whether a refresh/renewal endpoint is planned; the
   docs currently state the absence explicitly. */}

Role gates: `/api/admin/**` requires role `admin` (403 otherwise). Owner
checks apply to saved searches, dashboards, reports, and notifications.

## Conventions

| Thing | Behaviour |
|-------|-----------|
| Errors | Always `{"error": "<message>"}` with a 4xx/5xx status |
| Lists | Capped server-side (logs 200, notifications 50, alert events 100, audit 200) |
| IDs | Integers for Postgres resources, Mongo ObjectIds for log entries |
| Timestamps | RFC3339 / UTC |

## Recipes

Sign in and store the token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@logpulse.io","password":"changeme123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

Register an application and grab its ingest key:

```bash
curl -s -X POST http://localhost:8080/api/applications \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"payments-api"}'
```

Ingest (note: API key, not the JWT):

```bash
curl -X POST http://localhost:8080/api/logs \
  -H "Authorization: Bearer <APPLICATION_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"app_name":"payments-api","level":"error","message":"failed to charge card"}'
```

Read the failure signatures the clustering pipeline found:

```bash
curl -s "http://localhost:8080/api/clusters?hours=24&min_count=2" \
  -H "Authorization: Bearer $TOKEN"
```

Pull the root-cause analysis for incident #3:

```bash
curl -s http://localhost:8080/api/incidents/3/analysis \
  -H "Authorization: Bearer $TOKEN"
```

## Spec hygiene

- Response shapes come from the structs in `backend/internal/models/` and the
  response structs in the handlers — anything not explicit in code is marked
  with an `INFERRED` comment in the YAML.
- Known limits baked into the spec (200 log entries, 50 notifications, 100
  alert events, 200 audit rows) were confirmed by reading the handlers.
