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

test('drops the request path that captureRequestError adds and strips query strings', () => {
  const event = scrubEvent({
    transaction: 'GET /search?q=private&token=secret',
    tags: { url: 'https://example.com/search?q=private', route: '/search?q=private' },
    contexts: {
      nextjs: { request_path: '/search?q=private', router_kind: 'App Router', route_type: 'render' },
      trace: { trace_id: 't' },
      runtime: { name: 'node' },
    },
  });
  assert.equal(event.transaction, 'GET /search');
  assert.deepEqual(event.tags, { route: '/search' });
  assert.deepEqual(event.contexts, { runtime: { name: 'node' } });
  assert.ok(!JSON.stringify(event).includes('private'));
});

test('strips query strings from URLs in the exception message, frames and debug images', () => {
  const event = scrubEvent({
    exception: {
      values: [{
        value: 'Failed to fetch https://example.com/api?token=secret (from /page?q=private#frag)',
        stacktrace: { frames: [{ filename: 'https://example.com/app.js?v=private', abs_path: '/page?q=private' }] },
      }],
    },
    debug_meta: { images: [{ code_file: 'https://example.com/chunk.js?private=1' }] },
  });
  const value = event.exception?.values?.[0];
  assert.equal(value?.value, 'Failed to fetch https://example.com/api (from /page)');
  assert.deepEqual(value?.stacktrace?.frames?.[0], { filename: 'https://example.com/app.js', abs_path: '/page' });
  assert.equal(event.debug_meta?.images?.[0]?.code_file, 'https://example.com/chunk.js');
  assert.ok(!JSON.stringify(event).includes('private'));
});

test('strips queries from the top-level message, logentry and fingerprint of a thrown string', () => {
  // The SDK copies a thrown string into event.message and exception.values[0].value.
  const event = scrubEvent({
    message: 'Failed https://example.com/api?token=secret',
    logentry: { message: 'Failed %s', params: ['https://example.com/api?token=secret', 3] },
    fingerprint: ['{{ default }}', '/page?q=private'],
    exception: { values: [{ type: 'Error at /x?private=1', value: 'Failed https://example.com/api?token=secret' }] },
  });
  assert.equal(event.message, 'Failed https://example.com/api');
  assert.deepEqual(event.logentry, { message: 'Failed %s', params: ['https://example.com/api', 3] });
  assert.deepEqual(event.fingerprint, ['{{ default }}', '/page']);
  assert.equal(event.exception?.values?.[0]?.type, 'Error at /x');
  assert.ok(!JSON.stringify(event).includes('secret') && !JSON.stringify(event).includes('private'));
});

test('strips a query glued to a bare word with no scheme or leading slash', () => {
  const event = scrubEvent({ message: 'call api?token=secret&x=1 failed; are you sure? see item #5' });
  assert.equal(event.message, 'call api failed; are you sure? see item #5');
});

test('strips quoted, parenthesised, punctuation-only and leading queries up to the next space', () => {
  const event = scrubEvent({ message: '?key=secret at start; fetch("?token=secret") failed: api?token=(secret) and x?q=a\'secret\' (see /p?x=secret). Ref #access_token=secret ok' });
  const glued = scrubEvent({ message: 'Failed https://example.com/api?token=(secret)' });
  const punctuation = scrubEvent({ message: '/search?q=!!! and /api?password=secret!!! and /search#!!! and (/x?y=secret))' });
  assert.equal(event.message, ' at start; fetch(") failed: api and x (see /p Ref  ok');
  assert.equal(glued.message, 'Failed https://example.com/api');
  assert.equal(punctuation.message, '/search and /api and /search and (/x)');
  assert.ok(!/secret|!/.test(JSON.stringify([event, glued, punctuation])));
});
