# 09 — Data model (bindings, not a database)

ไม่มี SQL/KV/D1/Durable Object; persisted data อยู่ใน R2 bucket หนึ่งตัวและ Cloudflare Queue สองตัว (wrangler.toml) ER ด้านล่างเป็น "logical" ของ object และ message ที่ code เขียน

```mermaid
erDiagram
  R2_OBJECT {
    string key PK "bronze/stripe/YYYY/MM/DD/evt_id.json"
    string body "raw Stripe event JSON, unchanged"
    string contentType "application/json"
  }
  STRIPE_EVENT {
    string id PK "evt_[A-Za-z0-9_]+"
    string type
    number created "unix seconds, drives key date"
    boolean livemode
    json data_object
  }
  ENVELOPE {
    string id PK "= Stripe event id"
    string type "stripe.<event type>"
    int version "1"
    string occurred_at "ISO from created"
    string producer "hooks-worker"
    string correlation_id "= event id"
    string causation_id "null"
  }
  SUMMARY {
    string id
    string type
    number amount "amount_total / received / refunded / amount or null"
    string currency
    number created
    boolean livemode
    string payment_link
  }
  QUEUE_MESSAGE {
    string id PK
    int attempts
    string queue "hooks-inbound or hooks-inbound-dlq"
  }
  STRIPE_EVENT ||--|| R2_OBJECT : "stored raw as"
  STRIPE_EVENT ||--|| ENVELOPE : "wrapped in"
  ENVELOPE ||--|| SUMMARY : "data"
  QUEUE_MESSAGE ||--|| ENVELOPE : "body"
```

| Binding | Type | Name | ใช้ทำอะไร |
|---|---|---|---|
| `HOOKS_BUCKET` | R2 | `solo-empire-hooks` | raw event (bronze) |
| `HOOKS_QUEUE` | Queue producer + consumer | `hooks-inbound` | envelope; consumer batch 10 / 5 s / 5 retries |
| `HOOKS_DLQ` | Queue producer (อ่าน metrics เท่านั้น) | `hooks-inbound-dlq` | message ที่ forward ล้มเหลว |

Sources: `wrangler.toml`, `src/worker.ts` (`StripeEvent`, `stripeObjectKey`, `summarize`, `envelope`, `MessageLike`), `tests/events.test.ts`

## Open questions
- retention ของ raw object ใน R2 ไม่ได้กำหนด (lifecycle rule มีแค่ default multipart abort — ดู 14-backup-dr.md)
