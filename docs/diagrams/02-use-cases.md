# 02 — Use cases

Actors คือ caller จริงที่ code รองรับ: Stripe (signed by `STRIPE_WEBHOOK_SECRET`), uptime Worker (`GET /healthz`, ไม่มี auth), Cloudflare Queues runtime (เรียก `queue()` handler), forward target (รับ bearer `FORWARD_TOKEN`) และ owner (deploy / secret ผ่าน wrangler) ไม่มี user login หรือ role อื่น

```mermaid
flowchart LR
  stripe(["Actor: Stripe"])
  uptime(["Actor: uptime Worker solo-empire-monitor"])
  cfq(["Actor: Cloudflare Queues runtime"])
  target(["Actor: forward target (not set yet)"])
  owner(["Actor: Owner"])

  subgraph sys["solo-empire-hooks Worker"]
    uc1["UC1 Deliver signed Stripe event"]
    uc2["UC2 Store raw event in R2 (idempotent per evt id)"]
    uc3["UC3 Queue envelope to hooks-inbound"]
    uc4["UC4 Consume batch and forward envelope"]
    uc5["UC5 Park failed message in DLQ"]
    uc6["UC6 Report health and DLQ backlog"]
    uc7["UC7 Deploy, set secrets, rollback"]
  end

  stripe --> uc1
  uc1 --> uc2
  uc1 --> uc3
  cfq --> uc4
  uc4 --> target
  uc4 --> uc5
  uptime --> uc6
  owner --> uc7
```

Sources: `src/worker.ts` (`handleRequest`, `handleStripe`, `handleQueue`, `handleHealth`), `wrangler.toml`, `README.md` ("Owner deploy steps", "Rollback"), `bookchaowalit/platform-uptime-worker:src/targets.ts` (target `hooks-worker`)

| Use case | Actor | Trigger | Result |
|---|---|---|---|
| UC1 | Stripe | `POST /stripe` + `Stripe-Signature` | `200 {"received":true}` หรือ `400/413/503` |
| UC2 | (ภายใน UC1) | signature ok, `evt_` id | object `bronze/stripe/YYYY/MM/DD/<id>.json` |
| UC3 | (ภายใน UC1) | หลัง R2 write | envelope ใน `hooks-inbound`; ส่งไม่ได้ → `503` |
| UC4 | Cloudflare Queues | batch ≤10, timeout 5 s | ack / retry |
| UC5 | Cloudflare Queues | retry ครบ 5 ครั้ง | message ใน `hooks-inbound-dlq` |
| UC6 | uptime Worker | cron ทุก 5 นาที | `200 ok` หรือ `503` เมื่อ DLQ backlog > 0 |
| UC7 | Owner | manual | `wrangler deploy` / `secret put` / `rollback` |

## Open questions
- ยังไม่มี actor ที่อ่าน DLQ แล้ว replay (ADR-0008: "DLQs have no consumer that acts") — กระบวนการ replay เป็นมือ?
