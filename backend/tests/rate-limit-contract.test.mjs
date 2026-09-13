import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('production rate limiting is backed by postgres and not process-local state', () => {
  const config = read('../src/config.js');
  const observability = read('../src/observability.js');
  const schema = read('../src/db/schema.js');
  assert.match(config, /RATE_LIMIT_STORE/);
  assert.match(config, /RATE_LIMIT_STORE=postgres is required in production/);
  assert.match(observability, /createRateLimiter\(\{ pool:/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS rate_limit_windows/);
});

test('rate limiter hashes client identity before persistence', async () => {
  const mod = await import('../src/rate_limit.js');
  const calls = [];
  const pool = { query: async (q) => { calls.push(q); return { rows: [{ request_count: 1 }] }; } };
  const limiter = mod.createRateLimiter({ pool, trustProxy: true });
  const req = { headers: { 'x-forwarded-for': '203.0.113.20' }, socket: { remoteAddress: '127.0.0.1' } };
  await limiter.general(req, 10, 60000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[0].length, 64);
  assert.notEqual(calls[0].values[0], '203.0.113.20');
});
