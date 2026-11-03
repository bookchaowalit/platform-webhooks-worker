# 05 — C4 Context

```mermaid
C4Context
  title System Context - solo-empire-hooks (hooks.bookchaowalit.com)
  Person(owner, "Owner", "Deploys with wrangler, sets secrets, reads alerts")
  System_Ext(stripe, "Stripe", "Live webhook endpoint we_1UU0... sends checkout.session.completed, payment_intent.succeeded, charge.refunded")
  System(hooks, "solo-empire-hooks Worker", "Verifies Stripe signatures, stores raw events, queues envelopes")
  System_Ext(cf, "Cloudflare platform", "R2 bucket solo-empire-hooks, Queues hooks-inbound and hooks-inbound-dlq")
  System_Ext(uptime, "Uptime Worker solo-empire-monitor", "Probes /healthz every 5 min, alerts on Telegram")
  System_Ext(sentry, "Sentry", "Project platform-webhooks-worker, errors only")
  System_Ext(target, "Forward target", "FORWARD_URL - not set yet; planned payment cell ingest")
  Rel(stripe, hooks, "POST /stripe", "HTTPS, Stripe-Signature")
  Rel(hooks, cf, "put / send / consume / metrics", "Worker bindings")
  Rel(uptime, hooks, "GET /healthz", "HTTPS")
  Rel(hooks, sentry, "uncaught errors", "HTTPS")
  Rel(hooks, target, "POST envelope", "HTTPS bearer")
  Rel(owner, hooks, "deploy, secret put, rollback", "wrangler CLI")
```

Sources: `wrangler.toml`, `src/worker.ts`, `src/sentry.ts`, `README.md` ("State", "Stripe (2026-10-24…)", "Queue (2026-11-03…)"), `bookchaowalit/platform-uptime-worker:src/targets.ts`, `bookchaowalit/platform-uptime-worker:wrangler.toml`
