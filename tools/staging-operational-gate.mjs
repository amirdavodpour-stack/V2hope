import assert from 'node:assert/strict';

const base = String(process.env.STAGING_BASE_URL || '').replace(/\/$/, '');
assert.ok(base.startsWith('https://'), 'STAGING_BASE_URL must use HTTPS.');
const metricsToken = String(process.env.STAGING_METRICS_TOKEN || '');
assert.ok(metricsToken.length >= 24, 'STAGING_METRICS_TOKEN must be provided.');

async function get(path, headers = {}) {
  const response = await fetch(`${base}${path}`, { headers: { accept: 'application/json', ...headers } });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { response, body };
}

for (const endpoint of ['/live', '/ready', '/health']) {
  const result = await get(endpoint);
  assert.equal(result.response.status, 200, `${endpoint} returned ${result.response.status}: ${JSON.stringify(result.body)}`);
}

const metrics = await get('/metrics', { 'X-Metrics-Token': metricsToken });
assert.equal(metrics.response.status, 200, `metrics returned ${metrics.response.status}`);
const data = metrics.body?.data ?? metrics.body;
assert.ok(data && typeof data === 'object', 'metrics payload missing');
assert.equal(typeof data.errors5xx, 'number');
assert.equal(typeof data.recentHealth?.errorRate5xx, 'number');
assert.equal(typeof data.recentHealth?.slowRequestRate, 'number');
assert.equal(typeof data.outboxFailed, 'number');
assert.equal(typeof data.outboxProcessed, 'number');

const max5xxRate = Number(process.env.STAGING_MAX_5XX_RATE || '0.01');
const maxSlowRate = Number(process.env.STAGING_MAX_SLOW_RATE || '0.05');
const maxP95Ms = Number(process.env.STAGING_MAX_P95_MS || '500');
const maxP99Ms = Number(process.env.STAGING_MAX_P99_MS || '1000');
assert.ok(data.recentHealth.errorRate5xx <= max5xxRate, `recent 5xx rate ${data.recentHealth.errorRate5xx} > ${max5xxRate}`);
assert.ok(data.recentHealth.slowRequestRate <= maxSlowRate, `recent slow request rate ${data.recentHealth.slowRequestRate} > ${maxSlowRate}`);
assert.ok(Number(data.latency?.p95 ?? Infinity) <= maxP95Ms, `p95 ${data.latency?.p95} > ${maxP95Ms}`);
assert.ok(Number(data.latency?.p99 ?? Infinity) <= maxP99Ms, `p99 ${data.latency?.p99} > ${maxP99Ms}`);
assert.equal(data.health?.database?.status, 'ok', `database health is not ok: ${JSON.stringify(data.health?.database)}`);

console.log(JSON.stringify({
  status: 'PASS',
  recentHealth: data.recentHealth,
  latency: data.latency,
  outbox: { processed: data.outboxProcessed, failed: data.outboxFailed },
  database: data.health?.database,
}));
