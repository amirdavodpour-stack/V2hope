import test, { after } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-security-delta-');
const api = await startApiServer();

function auth(token) { return {Authorization: `Bearer ${token}`}; }

test('successful responses carry baseline security headers and a request id', async () => {
  const r = await api.json('/live');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('x-request-id') || '', /^[0-9a-f-]{20,}$/i);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('caller-supplied valid request id is preserved, invalid one is replaced', async () => {
  const valid = await api.json('/live', {headers: {'x-request-id': 'req_123-ABC'}});
  assert.equal(valid.headers.get('x-request-id'), 'req_123-ABC');
  const invalid = await api.json('/live', {headers: {'x-request-id': 'bad id\n'}});
  assert.notEqual(invalid.headers.get('x-request-id'), 'bad id');
  assert.ok(invalid.headers.get('x-request-id'));
});

test('malformed JSON fails as a client error instead of a 500', async () => {
  const response = await fetch(api.base + '/auth/login', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: '{"email":',
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_JSON');
  assert.ok(!JSON.stringify(body).includes('SyntaxError'));
});

test('oversized declared request is rejected before application parsing', async () => {
  const response = await fetch(api.base + '/auth/login', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({email: 'large@example.com', password: 'x', padding: 'x'.repeat(1024 * 1024 + 64)}),
  });
  const body = await response.json();
  assert.equal(response.status, 413);
  assert.equal(body.error.code, 'BODY_TOO_LARGE');
});

test('metrics endpoint is token-gated and explicitly non-cacheable', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /x-metrics-token/);
  assert.match(source, /Authentication required/);
  assert.match(source, /cache-control.*no-store/i);
  assert.match(source, /metricsSnapshot\(\)/);
});

test('invalid idempotency key is rejected at the API boundary', async () => {
  const owner = await register(api.json, 'sec-idem@example.com');
  const r = await api.json('/analytics/events', {
    method: 'POST',
    headers: {...auth(owner.accessToken), 'x-analytics-idempotency-key': 'contains spaces'},
    body: JSON.stringify({eventName: 'payment_attempt'}),
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_IDEMPOTENCY_KEY');
});

test('authentication never accepts malformed bearer prefixes as anonymous success', async () => {
  const r = await api.json('/providers/me', {headers: {Authorization: 'Token abc'}});
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'UNAUTHORIZED');
});

after(async () => closeApi({...api, tmp}));
