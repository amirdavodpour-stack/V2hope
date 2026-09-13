import test, { after } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-security-delta-');
const api = await startApiServer();

after(async () => { await closeApi({ ...api, tmp }); });

test('responses carry COOP and X-Permitted-Cross-Domain-Policies hardening headers', async () => {
  const r = await api.json('/live');
  assert.equal(r.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(r.headers.get('x-permitted-cross-domain-policies'), 'none');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('readBody rejects non-JSON content types with 415 instead of parsing raw bytes', async () => {
  const response = await fetch(api.base + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'email=a@b.com&password=whatever123',
  });
  const body = await response.json();
  assert.equal(response.status, 415);
  assert.equal(body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('metrics endpoint rejects a wrong token and accepts the configured one', async () => {
  const metricsBase = api.base.replace('/api/v1', '');
  const denied = await fetch(metricsBase + '/metrics', { headers: { 'x-metrics-token': 'definitely-wrong' } });
  assert.equal(denied.status, 401);
  const allowed = await fetch(metricsBase + '/metrics', { headers: { 'x-metrics-token': 'metrics-test-token-0123456789abcdef' } });
  assert.equal(allowed.status, 200);
});

test('source: refresh endpoint is throttled per presented token', () => {
  const src = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
  assert.match(src, /rateLimitAuthAccount/);
  assert.match(src, /refresh:/);
  assert.match(src, /Too many refresh attempts/);
});

test('source: metrics token comparison is constant-time', () => {
  const src = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(src, /timingSafeEqual/);
});

test('source: readBody enforces JSON content type', () => {
  const src = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  assert.match(src, /UNSUPPORTED_MEDIA_TYPE/);
  assert.match(src, /Content-Type must be application\/json/);
});
