# Troubleshooting & FAQ

Symptoms below are ordered by how often they bite. Each fix was verified
against the code or hit during a real run of the stack.

## Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Backend exits: `connection refused ... 5432` on Windows | `localhost` resolves to the WSL relay, not Docker | Use `127.0.0.1` in `POSTGRES_DSN` / `MONGO_URI` |
| Backend exits: `password authentication failed for user "logpulse"` | Existing Postgres volume initialized with a different password than your `.env` | Align them: `docker exec <pg> psql -U logpulse -d logpulse -c "ALTER USER logpulse WITH PASSWORD '…';"` or delete the volume for a fresh start |
| Browser console: CORS error on login | `FRONTEND_URL` doesn't match the SPA origin (port included) | Set `FRONTEND_URL` to the exact origin the browser shows, restart the backend |
| Login works, every API call 401s | Token from a different backend restart with a different `JWT_SECRET`, or >24h old | Sign in again; keep `JWT_SECRET` stable across restarts |
| `401 invalid api key` on ingest | Using a user JWT instead of the application key, or the app was deleted | `POST /api/logs` takes the **application API key** from the Applications page |
| Frontend can't reach the API in production | `VITE_API_URL` is baked into the JS bundle at build time | Set it correctly and rebuild the frontend image |
| Dashboard charts empty but logs exist | Served frontend bundle is stale (old build/dev server) | Hard-refresh; verify which port the dev server actually took |
| Live feed not updating | WebSocket dropped (proxy timeout, sleep) and reconnect isn't implemented | Reload the page — see the known limitation below |
| OAuth redirects back to login with an error | Callback URL mismatch, or no account exists for that email (invite-only) | Match `*_REDIRECT_URL` with the provider config; ask an admin to invite the email first |
| `docker compose up postgres mongo` leaves DBs unreachable | Production compose keeps DB ports internal | Add the dev override: `-f docker-compose.yml -f docker-compose.dev.yml` |

## FAQ

**Is there a refresh token?**
No. JWTs expire after 24 hours and clients sign in again. There is no
`/refresh` endpoint.
{/* TODO(human): confirm whether session renewal is planned before exposing
the dashboard to long-running operators. */}

**Why did my incident count not grow even though anomalies keep firing?**
By design. Sweeps within 30 minutes reuse the open correlated incident
instead of opening duplicates; only severity upgrades propagate.

**Why is an app "offline" in System Health when it's fine?**
Status derives from live log flow: silent for >15 minutes with a baseline
that expects traffic reads as offline. Quiet-but-healthy apps below the
traffic threshold aren't flagged.

**Do the AI features call any external service?**
No. Clustering, anomaly detection, correlation, forecasting, the copilot,
and NL alert parsing are all deterministic and run inside the backend.

**How long are logs retained?**
Until you decide. No TTL index ships by default — retention is an open FRD
question. Add a TTL on `logs.timestamp` when volume matters.

**Why don't old logs appear in clusters?**
Clustering needs the `pattern_hash` field, written at ingest since AI-1
shipped. Earlier documents lack it and are skipped by cluster queries.

**Can I run multiple backend replicas?**
The HTTP side is stateless, but the WebSocket hub and anomaly sweep are
in-process. One replica, or accept per-replica streams and duplicate sweeps,
until the Redis pub/sub item lands (see [Deployment](/docs/deployment)).

**Is the WebSocket authenticated?**
Not currently — see the warning in the
[WebSocket protocol](/docs/websocket-protocol). Keep it behind the edge
nginx or on a trusted network for now.

**Invite links expire?**
After 7 days. An admin re-invites (new token) if it lapses.
