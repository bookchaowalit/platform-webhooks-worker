# ADR-0001 — Cloudflare Worker บน hooks.bookchaowalit.com เขียน raw event ลง R2 ก่อนทำอย่างอื่น

- Status: accepted (retro-documented)
- Date of evidence: 2026-10-11 (first commit `c1f75d3`), custom domain 2026-10-23 (`986656e`)

## Context
Stripe retry webhook ได้ และ app ปลายทางอาจล่ม (PRODUCT.md "Problem") ต้องมี record ถาวรของทุก payment event ที่ rebuild ผลปลายทางได้

## Decision
- Host เป็น Cloudflare Worker `solo-empire-hooks` (`wrangler.toml` `name`, `main = "src/worker.ts"`) บน custom domain `hooks.bookchaowalit.com` และ `workers_dev = true`
- เขียน raw body ที่ verify แล้วลง R2 bucket `solo-empire-hooks` (binding `HOOKS_BUCKET`) ที่ key `bronze/stripe/YYYY/MM/DD/<event.id>.json` **ก่อน** queue หรือ forward ใด ๆ; id เดิมเขียนทับ → retry idempotent

## Evidence
`wrangler.toml` (`routes`, `[[r2_buckets]]`), `src/worker.ts` (`stripeObjectKey`, `handleStripe`), `README.md` ("State (2026-10-24)"), `bookchaowalit/platform-ops-cli:infra/platform/domains.yaml` (host `hooks.bookchaowalit.com`, `access: public-signed`, `status: live`)

## Consequences
- R2 คือ source of truth และ replay source (ADR-0008 rule 3 "Raw first")
- raw body ของ Stripe event อาจมีข้อมูลส่วนบุคคล (เช่น customer email ใน object) ถูกเก็บใน bronze — ไม่มี retention rule (ดู 14-backup-dr.md)
