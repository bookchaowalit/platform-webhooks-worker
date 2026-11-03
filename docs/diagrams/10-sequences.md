# 10 — Sequences

## S1 — Stripe event สำเร็จ (production path)

```mermaid
sequenceDiagram
  participant S as Stripe
  participant W as Worker fetch()
  participant R as R2 solo-empire-hooks
  participant Q as Queue hooks-inbound
  S->>W: POST /stripe (Stripe-Signature t=..,v1=..)
  W->>W: check secret, size <= 256 KB
  W->>W: HMAC-SHA256 verify, |now - t| <= 300 s
  W->>W: JSON.parse, validate evt_ id, type, created
  W->>R: put bronze/stripe/YYYY/MM/DD/evt_id.json
  R-->>W: ok
  W->>Q: send envelope (contentType json)
  Q-->>W: ok
  W-->>S: 200 {"received":true}
```

## S2 — Queue send ล้มเหลว (Stripe retry, R2 idempotent)

```mermaid
sequenceDiagram
  participant S as Stripe
  participant W as Worker fetch()
  participant R as R2
  participant Q as Queue hooks-inbound
  S->>W: POST /stripe
  W->>R: put key for evt_id
  W->>Q: send envelope
  Q--xW: error
  W-->>S: 503 queue_unavailable
  S->>W: retry same event later
  W->>R: put same key (overwrite)
  W->>Q: send envelope
  W-->>S: 200
```

## S3 — Consumer forward พร้อม retry และ DLQ

```mermaid
sequenceDiagram
  participant Q as Queue hooks-inbound
  participant C as Worker queue()
  participant T as Forward target FORWARD_URL
  participant D as hooks-inbound-dlq
  Q->>C: batch (up to 10 msgs, 5 s)
  alt FORWARD_URL or FORWARD_TOKEN unset (today)
    C->>Q: ack
  else target configured
    C->>T: POST envelope, Bearer, idempotency-key=id, 10 s timeout
    alt 2xx
      C->>Q: ack
    else non-2xx or network error
      C->>Q: retry delaySeconds = 30 x attempts
      Q->>D: after max_retries 5
    end
  end
```

## S4 — Health probe กับ DLQ backlog

```mermaid
sequenceDiagram
  participant U as Uptime Worker (cron */5)
  participant W as Worker fetch()
  participant D as hooks-inbound-dlq
  participant TG as Telegram
  U->>W: GET /healthz
  W->>D: metrics()
  D-->>W: backlogCount
  alt backlog > 0
    W-->>U: 503 {"ok":false,"dlq_backlog":n}
    U->>TG: alert after 2 failed checks
  else backlog 0 or metrics error
    W-->>U: 200 {"ok":true,"dlq_backlog":0 or null}
  end
```

Sources: `src/worker.ts`, `wrangler.toml`, `tests/queue.test.ts`, `tests/worker.test.ts`, `bookchaowalit/platform-uptime-worker:src/monitor.ts` (`FAILURES_BEFORE_DOWN = 2`), `bookchaowalit/platform-uptime-worker:wrangler.toml` (crons)
