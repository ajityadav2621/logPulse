# SDKs

:::info Status: placeholder page
This page gives you the 2-minute tour. The complete guide — building,
publishing to npm/PyPI/GitHub Packages/Go tags for free, and reliability
tuning — lives in `docs/SDK_GUIDE.md` in the repository.
:::

Three SDKs, one wire contract: `POST /api/logs` with a per-application API
key. All of them buffer in memory and flush in the background, so a LogPulse
outage never blocks or crashes your application.

| Language | Package | Framework middleware |
|----------|---------|---------------------|
| Go | `github.com/logpulse/logpulse-go` | Gin |
| Node / TypeScript | `@logpulse/sdk-node` | Express |
| Python | `logpulse-sdk` | FastAPI, Flask |

No SDK for your stack? The raw contract is one JSON POST — see
[First logs](/docs/getting-started/first-logs) for the curl shape that any
HTTP client can replicate.

## Get an API key

**Applications → Register Application** in the LogPulse UI (or
`POST /api/applications`). The key authorizes ingest for that one
application, making traffic attributable.

## Go

```go
import logpulse "github.com/logpulse/logpulse-go"

client := logpulse.New("YOUR_API_KEY", "payments-api")
defer client.Close() // flushes the buffer

client.Info("charge initiated", map[string]interface{}{"order_id": "ORD-1"})
client.Error("charge failed", map[string]interface{}{"code": "declined"})
```

Gin middleware — request, latency, and error capture with no per-route code:

```go
import "github.com/logpulse/logpulse-go/middleware"

r := gin.Default()
r.Use(middleware.Gin(client))
```

## Node / TypeScript

```ts
import { LogPulseClient } from '@logpulse/sdk-node'

const client = new LogPulseClient('YOUR_API_KEY', 'payments-api', {
  baseURL: 'http://your-logpulse-host:8080',
  bufferSize: 100,
  flushInterval: 5000,
})

client.error('charge failed', { order_id: 'ORD-1', code: 'declined' })

process.on('SIGINT', async () => { await client.close(); process.exit(0) })
```

Express middleware:

```ts
import { expressMiddleware } from '@logpulse/sdk-node'
app.use(expressMiddleware(client)) // ≥500 → error, ≥400 → warn, else info
```

## Python

```python
from logpulse import LogPulseClient

client = LogPulseClient(
    api_key="YOUR_API_KEY",
    app_name="payments-api",
    base_url="http://your-logpulse-host:8080",
)

client.error("charge failed", {"order_id": "ORD-1", "code": "declined"})
client.close()  # flush + stop the background flusher thread
```

FastAPI / Flask middleware:

```python
# FastAPI
app.middleware("http")(fastapi_middleware(client))

# Flask
app.wsgi_app = flask_middleware(client, app.wsgi_app)
```

## Reliability model

| Mechanism | Behaviour |
|-----------|-----------|
| Buffering | Entries queue in memory (default 100) |
| Async flush | Background flusher ships batches every `flushInterval` |
| Overflow | Buffer full → entries send immediately, best effort |
| Send failure | Logged locally, never thrown into your request path |
| Shutdown | `close()` / `Close()` flushes before exit |

## Why structured fields matter

`client.error("payment failed", {order_id, user_id})` — the fields land in
the log's `meta` and become queryable evidence. When an incident opens, the
root-cause copilot surfaces dominant values (one host, one error code) from
exactly these fields. Plain-text messages bury that signal.

## Building & publishing

See `docs/SDK_GUIDE.md` §5–6: per-language build commands, npm/PyPI/GitHub
Packages/Go-tag publishing (all free), and lockstep versioning with the
backend's additive-only wire contract.
