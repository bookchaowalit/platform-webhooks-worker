import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { computeSignature, envelope, handleQueue, handleRequest, type Env, type Envelope, type MessageLike } from '../src/worker.js';

// Test-only fixtures; not real credentials.
const signingKey = ['fixture', 'queue', 'key'].join('-');
const forwardCredential = ['fixture', 'queue', 'forward'].join('-');
const now = 1_790_000_000;
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const event = {
  id: 'evt_1QueueABC',
  type: 'payment_intent.succeeded',
  created: now,
  livemode: false,
  data: { object: { amount_received: 49000, currency: 'thb', receipt_email: 'private@example.com' } },
};

function makeEnv(extra: Partial<Env> = {}) {
  const puts: string[] = [];
  const sent: unknown[] = [];
  const env: Env = {
    HOOKS_BUCKET: { async put(key) { puts.push(key); return null; } },
    HOOKS_QUEUE: { async send(body) { sent.push(body); return null; } },
    STRIPE_WEBHOOK_SECRET: signingKey,
    ...extra,
  };
  return { env, puts, sent };
}

async function post(env: Env) {
  const body = JSON.stringify(event);
  const signature = `t=${now},v1=${await computeSignature(signingKey, now, body)}`;
  const request = new Request('https://hooks.example.com/stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body });
  return handleRequest(request, env, { waitUntil() { throw new Error('no best-effort forward when queued'); } }, now);
}

function message(body: Envelope, attempts = 1) {
  const state = { acked: false, retryDelay: undefined as number | undefined };
  const m: MessageLike<Envelope> = {
    id: 'm1', body, attempts,
    ack() { state.acked = true; },
    retry(options) { state.retryDelay = options?.delaySeconds ?? 0; },
  };
  return { m, state };
}

test('a verified event is written to R2 first and then queued as an envelope without personal data', async () => {
  const { env, puts, sent } = makeEnv({ FORWARD_URL: 'https://target.example.com/in', FORWARD_TOKEN: forwardCredential });
  const res = await post(env);
  assert.equal(res.status, 200);
  assert.equal(puts.length, 1);
  assert.equal(sent.length, 1);
  const env1 = sent[0] as Envelope;
  assert.equal(env1.id, 'evt_1QueueABC');
  assert.equal(env1.type, 'stripe.payment_intent.succeeded');
  assert.equal(env1.version, 1);
  assert.equal(env1.occurred_at, new Date(now * 1000).toISOString());
  assert.equal(env1.producer, 'hooks-worker');
  assert.equal(env1.data.amount, 49000);
  assert.ok(!JSON.stringify(env1).includes('private@example.com'));
});

test('a queue failure answers 503 so Stripe retries', async () => {
  const { env } = makeEnv({ HOOKS_QUEUE: { async send() { throw new Error('down'); } } });
  const res = await post(env);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'queue_unavailable' });
});

test('consumer forwards the envelope with an idempotency key and acks on 2xx', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('{}', { status: 202 }); }) as typeof fetch;
  const { env } = makeEnv({ FORWARD_URL: 'https://target.example.com/in', FORWARD_TOKEN: forwardCredential });
  const { m, state } = message(envelope(event));
  await handleQueue({ queue: 'hooks-inbound', messages: [m] }, env);
  assert.equal(state.acked, true);
  assert.equal(calls.length, 1);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['idempotency-key'], 'evt_1QueueABC');
  assert.equal(headers.authorization, `Bearer ${forwardCredential}`);
});

test('consumer retries with growing delay on a non-2xx answer or a network error', async () => {
  const { env } = makeEnv({ FORWARD_URL: 'https://target.example.com/in', FORWARD_TOKEN: forwardCredential });
  globalThis.fetch = (async () => new Response('no', { status: 500 })) as typeof fetch;
  const first = message(envelope(event), 1);
  await handleQueue({ queue: 'hooks-inbound', messages: [first.m] }, env);
  assert.equal(first.state.acked, false);
  assert.equal(first.state.retryDelay, 30);

  globalThis.fetch = (async () => { throw new Error('offline'); }) as typeof fetch;
  const third = message(envelope(event), 3);
  await handleQueue({ queue: 'hooks-inbound', messages: [third.m] }, env);
  assert.equal(third.state.retryDelay, 90);
});

test('consumer acks without a call when no forward target is configured', async () => {
  globalThis.fetch = (async () => { throw new Error('must not be called'); }) as typeof fetch;
  const { env } = makeEnv();
  const { m, state } = message(envelope(event));
  await handleQueue({ queue: 'hooks-inbound', messages: [m] }, env);
  assert.equal(state.acked, true);
});
