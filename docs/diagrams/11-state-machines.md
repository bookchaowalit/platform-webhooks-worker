# 11 — State machines

ไม่มี entity ที่มี field `status` ใน storage; lifecycle ที่ code ควบคุมจริงคือ queue message และสถานะ health

## Queue message (hooks-inbound)

```mermaid
stateDiagram-v2
  [*] --> Queued: send envelope after R2 put
  Queued --> Delivering: batch to queue()
  Delivering --> Acked: 2xx or no target configured
  Delivering --> RetryWait: non-2xx, network error or 10 s timeout
  RetryWait --> Delivering: after 30 s x attempts
  RetryWait --> Parked: retries exceed max_retries 5
  Parked --> [*]: in hooks-inbound-dlq, no consumer
  Acked --> [*]
```

## Worker health (/healthz)

```mermaid
stateDiagram-v2
  [*] --> Healthy
  Healthy --> Degraded: DLQ backlogCount > 0
  Degraded --> Healthy: DLQ drained (manual)
  Healthy --> Healthy: metrics() throws (reports dlq_backlog null)
```

## Incoming Stripe request

```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Rejected: 405, 503 not_configured, 413, 400 invalid_signature, 400 invalid_payload
  Received --> Stored: R2 put
  Stored --> Queued: queue send ok, 200
  Stored --> RetryByStripe: queue send fails, 503
  RetryByStripe --> Received: Stripe redelivers
  Rejected --> [*]
  Queued --> [*]
```

Sources: `src/worker.ts` (`handleQueue`, `handleHealth`, `handleStripe`), `wrangler.toml` (`[[queues.consumers]]`), `tests/queue.test.ts`

## Open questions
- การ drain DLQ (replay หรือ purge) ไม่มีใน repo — ทำด้วยมือผ่าน dashboard/wrangler?
