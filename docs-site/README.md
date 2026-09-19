# LogPulse Docs Site

Developer documentation for LogPulse, built with Docusaurus v3.

- **Interactive API reference** — Redoc rendering `openapi.yaml` (generated
  from the Go route registrations, not hand-written)
- **Architecture diagrams** — the same Mermaid diagrams maintained in the
  project README, rendered natively
- **Local search** — no external search service
- **shadcn-style theme** — emerald brand, zinc neutrals, light/dark

## Develop

```bash
npm install
npm run dev        # http://localhost:3001 with live reload
```

## Build

```bash
npm run build      # static site in build/
npm run serve      # preview the production build locally
```

`build/` is plain static files — deploy it free on GitHub Pages, Cloudflare
Pages, Netlify, or Vercel. Set `url` and `baseUrl` in `docusaurus.config.js`
for your real domain first.

## Structure

| Path | What it is |
|------|------------|
| `openapi.yaml` | OpenAPI 3.0 spec for the whole REST API (source of truth for the API Reference page) |
| `docs/` | Markdown/MDX pages (Overview, Getting Started, Architecture, WebSocket Protocol, Configuration, Deployment, SDKs, Troubleshooting, Changelog) |
| `src/pages/index.tsx` | Landing page at `/` |
| `src/css/custom.css` | Theme variables and component polish |
| `sidebars.js` | Sidebar ordering/groups |

## Regenerating the API spec

The spec is derived by hand from `backend/cmd/server/main.go` (route list)
and the response structs in `backend/internal/handlers/*.go` +
`backend/internal/models/models.go`. When you add or change an endpoint,
update `openapi.yaml` in the same PR — the API Reference page picks it up on
the next build. Entries that were inferred rather than read directly from
code carry `# INFERRED:` comments in the YAML.

## Dashboard integration

The LogPulse dashboard sidebar links here ("Developer Docs"), targeting
`VITE_DOCS_URL` (default `http://localhost:3001`).
