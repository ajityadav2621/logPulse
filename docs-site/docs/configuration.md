# Configuration Reference

Every environment variable LogPulse reads, grouped by where it applies.
Backend variables map 1:1 onto `backend/internal/config/config.go`; the
deployment-only variables are consumed by `deployment/docker-compose.yml`
and its dev override.

## Backend core

| Name | Required? | Default | Description |
|------|-----------|---------|-------------|
| `PORT` | no | `8080` | HTTP listen port for the API |
| `JWT_SECRET` | **yes in prod** | `dev-secret` | HS256 signing key for session JWTs. Change it — the default is public knowledge |
| `POSTGRES_DSN` | no | `host=localhost user=logpulse password=logpulse dbname=logpulse port=5432 sslmode=disable` | Postgres connection string (users, roles, incidents, alert events) |
| `MONGO_URI` | no | `mongodb://localhost:27017` | MongoDB connection string (log documents) |
| `MONGO_DB` | no | `logpulse` | Mongo database name |
| `FRONTEND_URL` | no | `http://localhost:5173` | Browser origin of the SPA. Used for CORS allow-list and the OAuth success/error redirects |

## Auth providers (OAuth)

All optional — leave empty to disable that provider's buttons.

| Name | Required? | Default | Description |
|------|-----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | no | *(empty)* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | no | *(empty)* | Google OAuth client secret |
| `GOOGLE_REDIRECT_URL` | no | `http://localhost:8080/api/auth/google/callback` | Callback URL registered with Google |
| `GITHUB_CLIENT_ID` | no | *(empty)* | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | no | *(empty)* | GitHub OAuth client secret |
| `GITHUB_REDIRECT_URL` | no | `http://localhost:8080/api/auth/github/callback` | Callback URL registered with GitHub |

## Bootstrap admin

Used once, on first boot with an empty `users` table. Nothing requires the
literal value `admin` — seed the account with a real person's email/username
and have them change the password after first login (or self-serve via
forgot-password).

| Name | Required? | Default | Description |
|------|-----------|---------|-------------|
| `SEED_ADMIN_NAME` | no | `Admin` | Display name |
| `SEED_ADMIN_EMAIL` | no | `admin@logpulse.io` | Login email |
| `SEED_ADMIN_PASSWORD` | no | `changeme123` | Login password — set a real one |

## Email / SMTP (password resets, invites)

Outbound email (forgot-password links, admin invites) is sent through any
SMTP provider. The defaults match Gmail: create the account
`logpulse.notification@gmail.com` (or reuse yours), enable 2FA, generate an
**App Password**, and use it as `SMTP_PASSWORD` — never the account password.
Port `587` uses STARTTLS; port `465` switches to implicit TLS.

| Name | Required? | Default | Description |
|------|-----------|---------|-------------|
| `SMTP_HOST` | no | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | no | `587` | SMTP port (`587` STARTTLS, `465` implicit TLS) |
| `SMTP_USERNAME` | **yes to send** | *(empty)* | SMTP login — the Gmail address for an App Password |
| `SMTP_PASSWORD` | **yes to send** | *(empty)* | App Password (2FA must be enabled on the account) |
| `SMTP_FROM_NAME` | no | `LogPulse` | Display name on outgoing messages |
| `EMAIL_FROM_ADDRESS` | no | `logpulse.notification@gmail.com` | Sender address |

When `SMTP_USERNAME` / `SMTP_PASSWORD` are empty, sending is disabled: every
message is still recorded in the `email_notifications` table and its body is
logged to backend output instead of being delivered — so the flows remain
testable locally and gaps stay visible. Every message is written to
`email_notifications` first (`pending` → `sent`/`failed`), and a background
worker retries `pending`/`failed` rows (up to 5 attempts) every minute.

## Advanced monitoring

| Name | Required? | Default | Description |
|------|-----------|---------|-------------|
| `ALERT_WEBHOOK_URL` | no | *(empty, disabled)* | POSTs fired alerts as JSON to any webhook (Slack/Discord/n8n). Repeat breaches inside a rule's cooldown are suppressed and not sent |
| `ANOMALY_INTERVAL_SECONDS` | no | `120` | Pause between background anomaly sweeps. Findings persist as incidents and notify admins in-app |

## Deployment-only (`deployment/.env`)

These never reach the Go code directly; compose substitutes them into the
container environment and host port mappings.

| Name | Required? | Default | Description |
|------|-----------|---------|-------------|
| `POSTGRES_USER` | no | `logpulse` | Postgres user (compose creates it) |
| `POSTGRES_PASSWORD` | **yes** | — | Postgres password (compose enforces it) |
| `POSTGRES_DB` | no | `logpulse` | Postgres database name |
| `VITE_API_URL` | no | `http://localhost:8080` | Browser-reachable backend URL, baked into the frontend image at build time |
| `BACKEND_HOST_PORT` | no | `8080` | Host port for the backend container |
| `FRONTEND_HOST_PORT` | no | `5173` | Host port for the frontend container |
| `EDGE_HTTP_PORT` | no | `80` | Edge nginx HTTP port (`--edge` profile) |
| `EDGE_HTTPS_PORT` | no | `443` | Edge nginx HTTPS port (`--edge` profile) |

## Dev-override only (`docker-compose.dev.yml`)

Publishes the databases to your host for local development. Never include
this file in production.

| Name | Required? | Default | Description |
|------|-----------|---------|-------------|
| `POSTGRES_HOST_PORT` | no | `5432` | Host port for Postgres |
| `MONGO_HOST_PORT` | no | `27017` | Host port for Mongo |

:::note Secrets hygiene
Only `.env.example` is committed. Real `.env` files are git-ignored — they
carry `JWT_SECRET`, database passwords, and OAuth secrets.
:::
