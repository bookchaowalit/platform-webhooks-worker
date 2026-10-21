import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSignature, parseSignatureHeader, verifyStripeSignature } from '../src/worker.js';

// Test-only fixtures; not real credentials.
const current = ['fixture', 'current', 'key'].join('-');
const previous = ['fixture', 'previous', 'key'].join('-');
const now = 1_790_000_000;
const body = '{"id":"evt_1"}';

test('header parsing keeps every v1 signature and ignores other schemes', () => {
  const a = 'a'.repeat(64);
  const b = 'B'.repeat(64);
  assert.deepEqual(parseSignatureHeader(`t=${now},v1=${a},v0=${'c'.repeat(64)},v1=${b}`), {
    timestamp: now,
    signatures: [a, 'b'.repeat(64)],
  });
});

test('header parsing rejects a missing timestamp, a non-numeric timestamp or no v1 signature', () => {
  const sig = 'a'.repeat(64);
  assert.equal(parseSignatureHeader(`v1=${sig}`), null);
  assert.equal(parseSignatureHeader(`t=abc,v1=${sig}`), null);
  assert.equal(parseSignatureHeader(`t=${now}`), null);
  assert.equal(parseSignatureHeader(`t=${now},v1=short`), null);
  assert.equal(parseSignatureHeader(''), null);
});

test('during secret rotation Stripe sends two v1 signatures; either valid one is accepted', async () => {
  const valid = await computeSignature(current, now, body);
  const stale = await computeSignature(previous, now, body);
  assert.equal(await verifyStripeSignature(`t=${now},v1=${stale},v1=${valid}`, body, current, now), true);
  assert.equal(await verifyStripeSignature(`t=${now},v1=${stale}`, body, current, now), false);
});

test('timestamps are accepted up to 300 s in either direction and rejected beyond', async () => {
  const at = (t: number) => computeSignature(current, t, body).then((s) => `t=${t},v1=${s}`);
  assert.equal(await verifyStripeSignature(await at(now - 300), body, current, now), true);
  assert.equal(await verifyStripeSignature(await at(now + 300), body, current, now), true);
  assert.equal(await verifyStripeSignature(await at(now - 301), body, current, now), false);
  assert.equal(await verifyStripeSignature(await at(now + 301), body, current, now), false);
});

test('a signature made with the right secret over a different timestamp does not verify', async () => {
  const sig = await computeSignature(current, now - 1, body);
  assert.equal(await verifyStripeSignature(`t=${now},v1=${sig}`, body, current, now), false);
});
