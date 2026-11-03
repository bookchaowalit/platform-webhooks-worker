# hooks-worker (`solo-empire-hooks`)

Cloudflare Worker for the reserved `hooks.bookchaowalit.com` host
(`infra/platform/domains.yaml`, access `public-signed`). It accepts signed
inbound webhooks and writes the raw event to R2 before anything else.

Current slice: **Stripe only**. LINE, GitHub, and iPaaS sources are future slices.

## Behavior

| Route | Behavior |
|---|---|
| `POST /stripe` | Verifies `Stripe-Signature` (`t=...,v1=...`, HMAC-SHA256 over `${t}.${rawBody}`, constant-time compare, 300 s tolerance). Invalid → `400`, without echoing the body. Valid → raw JSON written to `HOOKS_BUCKET` at `bronze/stripe/YYYY/MM/DD/<event.id>.json` (UTC date of `event.created`; the same id overwrites, so Stripe retries are idempotent), then `200 {"received":true}`. |
| `GET /healthz` | `200 {"ok":true}` |
| anything else | `404` (`405` for non-POST `/stripe`) |

- Body limit: 256 KB (`413` above it).
- Missing `STRIPE_WEBHOOK_SECRET` → `503` (no event accepted unverified).
- Errors: when the `SENTRY_DSN` secret is set, uncaught errors go to Sentry
  (`@sentry/cloudflare`, errors only: no tracing, breadcrumbs, request, headers,
  body or user; see `src/sentry.ts`). Unset = off.
- Queue (ADR-0008): after the R2 write the Worker sends an envelope
  `{id,type:"stripe.<type>",version,occurred_at,producer,correlation_id,causation_id,data}`
  to the Cloudflare Queue `hooks-inbound`; `data` is the minimal summary
  `{id,type,amount,currency,created,livemode,payment_link}` (no emails or names). If the
  queue send fails the answer is `503`, so Stripe retries (the R2 write is idempotent).
- Consumer: the same Worker consumes `hooks-inbound`. With `FORWARD_URL` and
  `FORWARD_TOKEN` set it POSTs the envelope with a bearer credential and an
  `idempotency-key` header (= event id); a non-2xx or network error is retried after
  30 s × attempt, and after 5 retries the message moves to `hooks-inbound-dlq`. Without a
  target it acks (the raw event in R2 is the source of truth).
- Without the `HOOKS_QUEUE` binding (local tests) the old best-effort `ctx.waitUntil`
  forward of the summary is used.

## Local checks

```bash
cd infra/hooks-worker
npm install
npm test
npm run typecheck
```

## State (2026-10-24)

Deployed from this repository with the Infisical `/cloudflare` token (account that owns the
`bookchaowalit.com` zone): R2 bucket `solo-empire-hooks`, custom domain `hooks.bookchaowalit.com`,
`SENTRY_DSN` set (Sentry project `platform-webhooks-worker`), uptime Worker watches `/healthz`.

Stripe (2026-10-24, live mode): endpoint `we_1UU0wgKKW2mNhAm655H3D0Za` →
`https://hooks.bookchaowalit.com/stripe`, events `checkout.session.completed`,
`payment_intent.succeeded`, `charge.refunded`. Its signing secret is in Infisical `/stripe`
as `STRIPE_WEBHOOK_SECRET` and set as the Worker secret. Smoke: a self-signed synthetic event
answered `200` and was written to `bronze/stripe/2026/10/24/` (object then deleted so it never
counts as revenue); a bad signature answered `400`.

Rollback: `npx wrangler secret delete STRIPE_WEBHOOK_SECRET` (route back to `503`), disable or
delete the endpoint in Stripe (`POST /v1/webhook_endpoints/<id>` `disabled=true`), or
`npx wrangler rollback` to the previous version.

Queue (2026-11-03, ADR-0008 M1): queues `hooks-inbound` and `hooks-inbound-dlq` created; the
Worker is producer and consumer (version `380307d1`). Smoke: synthetic signed event → `200`,
R2 object written, `wrangler tail` showed the queue batch consumed `ok`; object deleted
afterwards. No `FORWARD_URL` is set yet, so the consumer acks; the payment cell's ingest
endpoint becomes the target when it is ready.

## Owner deploy steps

These steps need the owner's Cloudflare and Stripe access. Run them yourself;
agents do not run `wrangler login`, create DNS, or set secrets.

```bash
cd infra/hooks-worker
npx wrangler login
npx wrangler r2 bucket create solo-empire-hooks
```

1. In the Stripe Dashboard → Developers → Webhooks, add an endpoint
   `https://hooks.bookchaowalit.com/stripe` subscribed to:
   `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`.
   Copy that endpoint's signing secret.
2. Store it as a Worker secret (paste at the prompt; never commit it):

   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   # optional forward
   npx wrangler secret put FORWARD_URL
   npx wrangler secret put FORWARD_TOKEN
   # optional error reporting
   npx wrangler secret put SENTRY_DSN
   ```

3. Uncomment the `routes` custom-domain block in `wrangler.toml` once the DNS
   binding for `hooks.bookchaowalit.com` is approved, then deploy:

   ```bash
   npx wrangler deploy
   ```

4. Smoke test:

   ```bash
   curl https://hooks.bookchaowalit.com/healthz
   ```

   Then use Stripe's "Send test webhook" and confirm an object appears under
   `bronze/stripe/` in the `solo-empire-hooks` bucket.

After a verified deploy, update the `hooks.bookchaowalit.com` entry status in
`infra/platform/domains.yaml`.
