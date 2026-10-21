import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSignature, handleRequest, summarize, type Env } from '../src/worker.js';

// Test-only fixture; not a real credential.
const signingKey = ['fixture', 'events', 'key'].join('-');
const now = 1_790_000_000;

function setup() {
  const puts: string[] = [];
  const env: Env = { HOOKS_BUCKET: { async put(key) { puts.push(key); return null; } }, STRIPE_WEBHOOK_SECRET: signingKey };
  const ctx = { waitUntil() {} };
  return { env, ctx, puts };
}

async function send(body: string) {
  const { env, ctx, puts } = setup();
  const signature = `t=${now},v1=${await computeSignature(signingKey, now, body)}`;
  const request = new Request('https://hooks.example.com/stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body });
  return { response: await handleRequest(request, env, ctx, now), puts };
}

test('a correctly signed body that is not JSON is rejected without writing R2', async () => {
  const { response, puts } = await send('not json');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_payload' });
  assert.equal(puts.length, 0);
});

test('event ids that could escape the R2 prefix or are not Stripe ids are rejected', async () => {
  for (const id of ['evt_../../secrets', 'evt_a/b', 'cus_123', '', 'evt_']) {
    const { response, puts } = await send(JSON.stringify({ id, type: 'charge.refunded', created: now }));
    assert.equal(response.status, 400, id);
    assert.equal(puts.length, 0, id);
  }
});

test('events without a string type or a numeric created time are rejected', async () => {
  for (const event of [{ id: 'evt_1', created: now }, { id: 'evt_1', type: 'x', created: '1790000000' }]) {
    const { response } = await send(JSON.stringify(event));
    assert.equal(response.status, 400);
  }
});

test('summaries pick the amount field of each subscribed event type and drop personal data', () => {
  const base = { id: 'evt_1', created: now, livemode: true };
  const checkout = summarize({ ...base, type: 'checkout.session.completed', data: { object: { amount_total: 49000, currency: 'thb', customer_email: 'a@example.com' } } });
  const intent = summarize({ ...base, type: 'payment_intent.succeeded', data: { object: { amount_received: 1200, currency: 'usd' } } });
  const refund = summarize({ ...base, type: 'charge.refunded', data: { object: { amount_refunded: 500, amount: 1200, currency: 'usd' } } });
  assert.equal(checkout.amount, 49000);
  assert.equal(intent.amount, 1200);
  assert.equal(refund.amount, 500);
  assert.equal(checkout.livemode, true);
  assert.equal(JSON.stringify(checkout).includes('a@example.com'), false);
});

test('summaries never pass through non-numeric amounts or non-string currencies', () => {
  const s = summarize({ id: 'evt_1', type: 'x', created: now, data: { object: { amount_total: '49000', currency: 7 } } });
  assert.equal(s.amount, null);
  assert.equal(s.currency, null);
  assert.equal(s.payment_link, null);
  assert.equal(summarize({ id: 'evt_2', type: 'x', created: now }).livemode, false);
});
