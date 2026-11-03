# ADR-0003 — Worker เดียวเป็นทั้ง producer และ consumer ของ Cloudflare Queue hooks-inbound (ADR-0008 M1)

- Status: accepted (retro-documented); implements central [ADR-0008](https://github.com/bookchaowalit/architecture-docs/blob/main/docs/architecture/decisions/ADR-0008-messaging-queue-and-event-broker.md)
- Date of evidence: 2026-11-03 (`ac2c288`, `1ecca28`, `4f8eb72`)

## Context
ก่อนหน้านี้ forward เป็น best effort ผ่าน `ctx.waitUntil`; forward ที่ fail หายไป (ADR-0008 "Current state")

## Decision
- หลัง R2 write ส่ง envelope `{id,type:"stripe.<type>",version:1,occurred_at,producer:"hooks-worker",correlation_id,causation_id:null,data}` เข้า `hooks-inbound` (binding `HOOKS_QUEUE`); send fail → `503` ให้ Stripe retry
- Consumer ใน Worker เดียวกัน: `max_batch_size = 10`, `max_batch_timeout = 5`, `max_retries = 5`, `dead_letter_queue = "hooks-inbound-dlq"`; retry delay `30 s × attempts`; timeout ต่อ forward 10 s
- `/healthz` อ่าน `HOOKS_DLQ.metrics().backlogCount` และตอบ `503` เมื่อ > 0
- ไม่มี target → ack (R2 เป็น source of truth)

## Evidence
`wrangler.toml` (`[[queues.producers]]`, `[[queues.consumers]]`), `src/worker.ts` (`envelope`, `handleQueue`, `handleHealth`), `tests/queue.test.ts`, `README.md` ("Queue (2026-11-03, ADR-0008 M1)")

## Deviation from ADR-0008
- ADR-0008 rule 1 กำหนด `id` เป็น ULID และ `type` รูปแบบ `<domain>.<entity>.<verb>`; code ใช้ Stripe event id (`evt_…`) เป็น `id` และ `type` = `stripe.<stripe type>` (comment ใน code: "consumers dedupe on it") — owner ควรยืนยันว่ายอมรับ
