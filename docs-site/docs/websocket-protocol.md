# WebSocket Protocol

The live log stream is a plain WebSocket endpoint — it is not part of the
OpenAPI spec, so this page documents it by hand. Everything below is read
from `backend/internal/ws/hub.go`, the route registration in
`backend/cmd/server/main.go`, and the client hook `frontend/src/hooks/useLogStream.ts`.

## Connection

| Property | Value |
|----------|-------|
| URL | `ws://<host>:8080/ws/logs` (dev) / `wss://<host>/ws/logs` (behind edge nginx/TLS) |
| Handshake | Standard WebSocket upgrade via HTTP GET |
| Auth | **None** — the route is registered without the JWT middleware |
| Direction | Server → client only (push) |
| Format | One JSON text frame per log entry |

In the frontend the URL is derived from the page origin, and the Vite dev
server proxies `/ws` to `ws://localhost:8080`:

```ts
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${window.location.host}/ws/logs`);
```

:::warning No authentication
`/ws/logs` currently accepts any connection — `hub.go` sets
`CheckOrigin: func(r) bool { return true }` and the route is outside the
JWT group. This is fine for local/free-tier dev. Before exposing LogPulse to
an untrusted network, serve it behind the edge nginx with network-level
controls or add a token check to the upgrade request.
{/* TODO(human): decide the production story — signed short-lived query
   token on the upgrade request, origin allowlist, or network-level gating. */}
:::

## Pushed message shape

Each broadcast is a single text frame containing one serialized `LogEntry`
(the same shape as `GET /api/logs` items):

```json
{
  "id": "665f1c2e3a4b5c6d7e8f9012",
  "app_name": "payments-api",
  "level": "error",
  "message": "failed to charge card order=ORD-10293",
  "meta": { "order_id": "ORD-10293", "user_id": 42 },
  "timestamp": "2026-09-19T10:00:00Z",
  "pattern_hash": "b3f1a0c2d4e5f607",
  "pattern": "failed to charge card <id> <id>"
}
```

| Field | Notes |
|-------|-------|
| `id` | Mongo ObjectId string |
| `level` | Normalized at ingest (`warn`→`warning`, `err`→`error`, `crit`→`critical`) |
| `meta` | Omitted when the sender didn't include structured fields |
| `pattern_hash` / `pattern` | Present when the entry was ingested after fingerprinting shipped (AI-1) |

## Server behaviour

- A broadcast happens **after** the Mongo insert succeeds — a frame on the
  socket means the entry is durably stored.
- Fan-out is synchronous: each connected client's write failure closes and
  removes that client; other clients are unaffected.
- Client → server messages are read and discarded. The read loop exists only
  to detect disconnects.
- The hub is in-process: with multiple backend replicas each replica only
  pushes to clients connected to it (see FRD scaling note — a shared pub/sub
  such as Redis is the planned fix). Run one replica, or accept per-replica
  streams, until then.
- There is **no backlog/replay**: entries broadcast while you were
  disconnected are gone from the stream (fetch them via `GET /api/logs`).
- No ping/pong keepalive is implemented.
  {/* TODO(human): confirm whether to add protocol-level ping/pong for
     proxies that kill idle connections (nginx default proxy_read_timeout
     is 60s — behind the edge nginx this matters). */}

## Client behaviour (reference implementation)

`useLogStream.ts` in the dashboard:

| Aspect | Implemented behaviour |
|--------|----------------------|
| Buffer cap | Newest 200 entries kept in memory |
| Error tracking | Last `error`-level entry surfaced separately |
| Connection state | `connected` flag from `onopen` / `onclose` / `onerror` |
| Reconnect | **Not implemented** — a dropped stream stays down until the page is reloaded |
{/* TODO(human): auto-reconnect with backoff is the obvious next step for
   the frontend hook; documented as absent so nobody assumes it exists. */}
