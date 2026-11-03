# ADR-0004 — Sentry แบบ errors only พร้อม scrub, ปิดเมื่อไม่มี SENTRY_DSN

- Status: accepted (retro-documented)
- Date of evidence: 2026-10-22 (`9719421`), scrub fix 2026-10-23 (`15b1f0a`)

## Decision
- `@sentry/cloudflare` ห่อ handler ด้วย `Sentry.withSentry`; `enabled: Boolean(dsn)`
- ไม่มี tracing (`tracesSampleRate: undefined`, `beforeSendTransaction: () => null`), `tracePropagationTargets: []`, `maxBreadcrumbs: 0`
- `scrubEvent` ลบ `request`, `user`, `breadcrumbs`, `extra`, frame `vars`; เก็บ contexts เฉพาะ `os, runtime, browser, device, app`; ตัด query/hash จาก transaction, tags, exception message, frames, debug images
- `nodejs_als` compatibility flag (wrangler.toml comment)

## Evidence
`src/sentry.ts`, `src/worker.ts`, `wrangler.toml`, `tests/sentry.test.ts`, `README.md` (Sentry project `platform-webhooks-worker`)

## Consequences
- `Stripe-Signature` header และ body ไม่ถึง Sentry; error ที่ถูกจับใน `try/catch` (queue send, forward) ไม่ถูกส่ง Sentry
