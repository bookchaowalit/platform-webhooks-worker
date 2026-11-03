# 03 — User flows (per caller)

ไม่มีหน้าเว็บหรือ UI; "user" คือ caller ของ HTTP route และ queue ตาม `handleRequest` / `handleQueue`

## Flow A — Stripe ส่ง event (`POST /stripe`)

```mermaid
flowchart TD
  s["Stripe POST /stripe"] --> m{"method POST?"}
  m -- "no" --> r405["405 method_not_allowed"]
  m -- "yes" --> sec{"STRIPE_WEBHOOK_SECRET set?"}
  sec -- "no" --> r503a["503 not_configured"]
  sec -- "yes" --> size{"body <= 256 KB?"}
  size -- "no" --> r413["413 payload_too_large"]
  size -- "yes" --> sig{"t within 300 s and a v1 HMAC matches?"}
  sig -- "no" --> r400a["400 invalid_signature"]
  sig -- "yes" --> js{"JSON with evt_ id, string type, numeric created?"}
  js -- "no" --> r400b["400 invalid_payload"]
  js -- "yes" --> put["R2 put bronze/stripe/..."]
  put --> q{"HOOKS_QUEUE bound?"}
  q -- "yes" --> send{"queue send ok?"}
  send -- "no" --> r503b["503 queue_unavailable"]
  send -- "yes" --> ok["200 received:true"]
  q -- "no (local tests)" --> fw{"FORWARD_URL and FORWARD_TOKEN?"}
  fw -- "yes" --> wu["ctx.waitUntil best-effort forward of summary"] --> ok
  fw -- "no" --> ok
```

## Flow B — uptime Worker (`GET /healthz`)

```mermaid
flowchart TD
  u["GET /healthz"] --> b{"HOOKS_DLQ.metrics available?"}
  b -- "no" --> ok1["200 ok:true"]
  b -- "yes" --> mt["read backlogCount"]
  mt -- "throws" --> ok2["200 ok:true, dlq_backlog:null"]
  mt -- "0" --> ok3["200 ok:true, dlq_backlog:0"]
  mt -- "> 0" --> bad["503 ok:false, dlq_backlog:n"]
```

## Flow C — Queue consumer

```mermaid
flowchart TD
  b["batch from hooks-inbound"] --> each["for each message"]
  each --> t{"FORWARD_URL and FORWARD_TOKEN?"}
  t -- "no" --> ack1["ack"]
  t -- "yes" --> post["POST envelope, bearer, idempotency-key = id, 10 s timeout"]
  post -- "2xx" --> ack2["ack"]
  post -- "non-2xx or error" --> rt["retry delay 30 s x attempts"]
  rt --> mx{"retries > 5?"}
  mx -- "yes" --> dlq["moved to hooks-inbound-dlq by Cloudflare"]
```

อื่น ๆ: path ใดที่ไม่ใช่ `/healthz` (GET) หรือ `/stripe` → `404 not_found` (รวม `POST /healthz`)

Sources: `src/worker.ts`, `wrangler.toml` (`[[queues.consumers]]`), `tests/worker.test.ts`, `tests/queue.test.ts`
