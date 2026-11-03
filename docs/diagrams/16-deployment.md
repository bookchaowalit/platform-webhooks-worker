# 16 — Deployment

```mermaid
flowchart LR
  dev["Owner/agent machine: npx wrangler deploy (infisical run --path /cloudflare)"] -->|"upload version"| cfw
  subgraph cf["Cloudflare account owning zone bookchaowalit.com"]
    dom["Custom domain hooks.bookchaowalit.com"] --> cfw["Worker solo-empire-hooks, compat 2026-10-04, nodejs_als"]
    wd["*.workers.dev (workers_dev = true)"] --> cfw
    cfw -->|"HOOKS_BUCKET"| r2[("R2 solo-empire-hooks")]
    cfw -->|"HOOKS_QUEUE"| q[["Queue hooks-inbound"]]
    q -->|"consumer"| cfw
    q -->|"dead_letter_queue"| dlq[["Queue hooks-inbound-dlq"]]
    cfw -->|"HOOKS_DLQ metrics"| dlq
    secrets["Secrets: STRIPE_WEBHOOK_SECRET, SENTRY_DSN; FORWARD_URL and FORWARD_TOKEN not set"] --> cfw
  end
  stripe["Stripe live endpoint"] --> dom
  uptime["Uptime Worker"] --> dom
  cfw --> sentry["Sentry project platform-webhooks-worker"]
```

| Item | Value | Source |
|---|---|---|
| Worker name | `solo-empire-hooks` | `wrangler.toml` |
| Route | `hooks.bookchaowalit.com` custom domain | `wrangler.toml`, `README.md` |
| Env | production เดียว ไม่มี `[env.*]` / staging | `wrangler.toml` |
| Current version | `03d4e656` (2026-11-03 16:20Z) | `wrangler deployments list` (2026-11-03) |
| Registry | `domains.yaml` status `live`, `access: public-signed` | `bookchaowalit/platform-ops-cli:infra/platform/domains.yaml` |

Sources: `wrangler.toml`, `README.md`, `package.json`; ops record: messaging-layer-adr-0008 (2026-11-03) ("no FORWARD_URL yet")

## Open questions
- `README.md` "Owner deploy steps" ยังใช้ `cd infra/hooks-worker` และบอกให้ uncomment routes (ล้าสมัยหลังย้ายออกจาก hub และ bind domain แล้ว)
- ไม่มี staging environment — ตั้งใจหรือไม่?
