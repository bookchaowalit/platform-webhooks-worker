# 21 — Incident response

ไม่มี runbook แยกใน repo; flow ด้านล่างประกอบจาก alert channel ที่มีจริง (uptime → Telegram, Sentry) และ rollback/kill-switch ใน README

```mermaid
flowchart TD
  a1["Uptime Worker: /healthz down 2 checks"] --> tg["Telegram alert"]
  a2["Sentry error event"] --> sn["Sentry issue"]
  a3["Stripe Dashboard: failed deliveries"] --> own
  tg --> own["Owner triage"]
  sn --> own
  own --> k{"Symptom"}
  k -- "503 dlq_backlog > 0" --> f1["Check FORWARD_URL target; inspect hooks-inbound-dlq"]
  k -- "5xx after deploy" --> f2["npx wrangler rollback"]
  k -- "400 invalid_signature spike" --> f3["Check STRIPE_WEBHOOK_SECRET vs Infisical /stripe; Stripe secret rotation"]
  k -- "must stop intake" --> f4["wrangler secret delete STRIPE_WEBHOOK_SECRET or disable Stripe endpoint"]
  f1 --> fix["Fix and redeploy: npx wrangler deploy"]
  f2 --> fix
  f3 --> fix
  f4 --> fix
  fix --> ver["Verify: GET /healthz, signed smoke event, wrangler tail"]
  ver --> pm["Postmortem: not defined in repo"]
```

Sources: `README.md` ("Rollback", "State", smoke steps), `src/worker.ts` (`handleHealth` comment "the uptime Worker alerts on Telegram"), `bookchaowalit/platform-uptime-worker:src/monitor.ts`

## Open questions
- ที่เก็บ postmortem / incident log ของ platform service นี้?
- severity และ on-call (solo owner) — ยังไม่กำหนดใน repo
