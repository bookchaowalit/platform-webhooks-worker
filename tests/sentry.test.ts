import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrubEvent, sentryOptions } from '../src/sentry.js';

test('Sentry stays off when SENTRY_DSN is not set', () => {
  assert.equal(sentryOptions({}).enabled, false);
});

test('errors only: no PII, tracing, trace headers, breadcrumbs or transactions', () => {
  const options = sentryOptions({ SENTRY_DSN: 'https://key@o0.ingest.sentry.io/1' });
  assert.equal(options.enabled, true);
  assert.notEqual((options as { sendDefaultPii?: boolean }).sendDefaultPii, true);
  assert.equal(options.tracesSampleRate, undefined);
  assert.deepEqual(options.tracePropagationTargets, []);
  assert.equal(options.maxBreadcrumbs, 0);
  assert.equal(options.beforeSendTransaction(), null);
});

test('events lose the request (URL, headers, Stripe-Signature, body), user, extra and frame locals', () => {
  const event = scrubEvent({
    message: 'boom',
    request: { url: 'https://hooks.example.com/stripe', headers: { 'stripe-signature': 't=1,v1=abc' }, data: '{"customer_email":"x"}' },
    user: { ip_address: '1.2.3.4' },
    breadcrumbs: [{ message: 'fetch' }],
    extra: { body: 'raw' },
    exception: { values: [{ stacktrace: { frames: [{ function: 'handleStripe', vars: { rawBody: '{}' } }] } }] },
  });
  assert.equal(event.message, 'boom');
  for (const key of ['request', 'user', 'breadcrumbs', 'extra'] as const) assert.equal(event[key], undefined, key);
  assert.equal(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars, undefined);
});
