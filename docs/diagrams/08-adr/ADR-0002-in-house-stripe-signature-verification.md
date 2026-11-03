# ADR-0002 — ตรวจ Stripe signature เองด้วย WebCrypto (ไม่ใช้ Stripe SDK)

- Status: accepted (retro-documented)

## Context
Worker runtime ต้องการ dependency น้อย และต้องรองรับ secret rotation

## Decision
- ไม่มี `stripe` package ใน `package.json`; dependency runtime เดียวคือ `@sentry/cloudflare`
- `computeSignature` ใช้ `crypto.subtle` HMAC-SHA256 บน `${t}.${rawBody}`; `timingSafeEqual` เทียบแบบ constant-time; tolerance `TOLERANCE_SECONDS = 300` ทั้งสองทิศ; รับหลาย `v1=` (rotation) และ ignore scheme อื่น
- ตรวจ signature **ก่อน** parse JSON; ไม่ echo body เมื่อ reject

## Evidence
`src/worker.ts` (`parseSignatureHeader`, `computeSignature`, `verifyStripeSignature`), `package.json`, `tests/signature.test.ts`, `tests/worker.test.ts`

## Consequences
- ต้องดูแล logic เองเมื่อ Stripe เปลี่ยน scheme; มี test ครอบ rotation, timestamp, tampered body
