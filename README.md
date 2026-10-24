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
- Optional forward: when both `FORWARD_URL` and `FORWARD_TOKEN` are set, a
  minimal summary `{id,type,amount,currency,created,livemode,payment_link}` is
  POSTed with a bearer credential through `ctx.waitUntil`. It is best effort and never
  delays or changes the `200`; the raw event in R2 remains the source of truth.

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
