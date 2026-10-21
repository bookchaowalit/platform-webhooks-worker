# platform-webhooks-worker — Product Brief

Status on 2026-10-22: **built, not verified live.** `hooks.bookchaowalit.com` does not resolve (the custom-domain
route in `wrangler.toml` is still commented out, waiting for the owner's DNS approval), the Worker is not in the
uptime monitor, and its Cloudflare account (`4a3ba0ee…`) is not readable with the platform's Cloudflare token, so
whether a `workers.dev` deployment exists could not be checked.

## Who it is for

The owner's money and sales tooling, which needs a durable record of every Stripe payment event. There are no
end users; Stripe is the only caller.

## Problem

Stripe retries webhooks and a receiving app can be down or buggy. Writing the signed raw event to storage first,
before any processing, means no payment event is lost and every downstream result can be rebuilt from the raw record.

## What exists

| Capability | Detail |
|---|---|
| `POST /stripe` | verifies `Stripe-Signature` (HMAC-SHA256, constant-time compare, ±300 s, several `v1` signatures for secret rotation); rejects bodies over 256 KB, invalid JSON and non-`evt_` ids |
| Raw storage | R2 bucket `solo-empire-hooks`, key `bronze/stripe/YYYY/MM/DD/<event.id>.json`; the same id overwrites, so Stripe retries are idempotent |
| Optional forward | minimal summary `{id,type,amount,currency,created,livemode,payment_link}` to `FORWARD_URL`, best effort, never changes the `200` |
| `GET /healthz` | `{"ok":true}` |
| Error reporting | Sentry when `SENTRY_DSN` is set (errors only, request and body never sent) |
| Tests | 25 tests in `tests/` (signature, events and summaries, Sentry options, routing) |

Out of scope today: LINE, GitHub and iPaaS sources (README "future slices").

## Success measures (once deployed)

| Measure | How it is read | Target |
|---|---|---|
| Event completeness | R2 objects under `bronze/stripe/` vs events listed in the Stripe Dashboard for the same day | 100% |
| Signature rejections | `400 invalid_signature` responses in Worker logs | 0 from Stripe's IPs |
| Availability | uptime probe of `/healthz` (to be added after deploy) | ≥ 99.9% monthly |

## Owner actions before it is live

Approve the DNS binding for `hooks.bookchaowalit.com`, create the R2 bucket, set `STRIPE_WEBHOOK_SECRET` (and
optionally `SENTRY_DSN`, `FORWARD_URL`, `FORWARD_TOKEN`), deploy with `npx wrangler deploy`, then add the
endpoint in Stripe. Steps are in README.
