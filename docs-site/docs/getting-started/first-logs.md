# First logs

From zero to live logs on the dashboard in five steps.

## 1. Sign in

Open the frontend (http://localhost:5173 in dev) and sign in with the
bootstrap admin credentials (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## 2. Register an application

Go to **Applications → Register Application** and give it a name, e.g.
`payments-api`. You get an **API key** — this is the credential your service
uses to ingest.

## 3. Send a log

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="ingest-client" defaultValue="curl">
<TabItem value="curl" label="curl">

```bash
curl -X POST http://localhost:8080/api/logs \
  -H "Authorization: Bearer <APPLICATION_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"app_name":"payments-api","level":"error","message":"failed to charge card"}'
```

</TabItem>
<TabItem value="node" label="Node.js">

```js
await fetch('http://localhost:8080/api/logs', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <APPLICATION_API_KEY>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    app_name: 'payments-api',
    level: 'error',
    message: 'failed to charge card',
  }),
});
```

</TabItem>
<TabItem value="python" label="Python">

```python
import requests

requests.post(
    "http://localhost:8080/api/logs",
    headers={
        "Authorization": "Bearer <APPLICATION_API_KEY>",
        "Content-Type": "application/json",
    },
    json={
        "app_name": "payments-api",
        "level": "error",
        "message": "failed to charge card",
    },
)
```

</TabItem>
</Tabs>

Structured fields go in `meta` — they become queryable evidence for the
root-cause analysis:

```bash
curl -X POST http://localhost:8080/api/logs \
  -H "Authorization: Bearer <APPLICATION_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"app_name":"payments-api","level":"error","message":"failed to charge card","meta":{"order_id":"ORD-1","user_id":42}}'
```

## 4. Watch it live

Open the dashboard. The entry appears in the live feed instantly (WebSocket).
Then explore:

| Page | What you see |
|------|--------------|
| Dashboard | headline stats, volume chart, open incidents, live anomaly sweep |
| Analytics | volume/error-rate timeseries, failure-signature clusters, forecast |
| Incidents | auto-detected and manually declared incidents, root-cause analysis |
| System Health | per-app status (healthy / degraded / offline) from live flow |
| Alerts | threshold rules, trigger history, plain-language authoring |

## 5. Describe an alert in words

On the **Alerts** page, type a sentence into the authoring box:

```text
Alert me when payments-api has more than 5 errors mentioning timeout within 2 minutes
```

"Parse to rule" compiles it into a draft — review the pre-filled form and
create it. Nothing goes live until you confirm.

## Replace curl with an SDK

For real services use one of the SDKs — they batch, flush in the background,
and never block your request path:

- [SDKs overview](/docs/sdks)
- Full guide with publishing steps: `docs/SDK_GUIDE.md` in the repo
