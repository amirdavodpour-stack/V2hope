import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { requestId, recordRequest, metricsSnapshot, recordOutboxProcessed, recordOutboxFailed } from '../src/observability.js';

test('request ids reject unbounded or unsafe caller-controlled values', () => {
  assert.match(requestId({ headers: { 'x-request-id': 'mobile-42_ok' } }), /^mobile-42_ok$/);
  const generated = requestId({ headers: { 'x-request-id': 'x'.repeat(129) } });
  assert.doesNotMatch(generated, /^x+$/);
});

test('metrics expose latency and outbox counters', () => {
  const before = metricsSnapshot();
  recordRequest(200, 12.5);
  recordRequest(503, 30);
  recordOutboxProcessed();
  recordOutboxFailed();
  const after = metricsSnapshot();
  assert.equal(after.requests, before.requests + 2);
  assert.ok(after.requestDurationMsAvg > 0);
  assert.ok(after.requestDurationMsMax >= 30);
  assert.equal(after.outboxProcessed, before.outboxProcessed + 1);
  assert.equal(after.outboxFailed, before.outboxFailed + 1);
});

test('metrics expose latency percentiles and per-category failure counters', () => {
  const before = metricsSnapshot();
  recordRequest(200, 10);
  recordRequest(200, 20);
  recordRequest(200, 30);
  const after = metricsSnapshot();
  assert.ok('p50' in after.latency && 'p95' in after.latency && 'p99' in after.latency);
  assert.ok(after.latency.p99 >= after.latency.p50);
  assert.ok(after.categoryFailures.payment >= before.categoryFailures.payment);
  assert.ok(['payment', 'push', 'email', 's3'].every(k => typeof after.categoryFailures[k] === 'number'));
});

test('metrics include bounded process memory telemetry and uptime', () => {
  const snapshot = metricsSnapshot();
  assert.ok(Number.isInteger(snapshot.uptimeSeconds) && snapshot.uptimeSeconds >= 0);
  for (const key of ['rssBytes', 'heapUsedBytes', 'heapTotalBytes', 'externalBytes']) {
    assert.ok(Number.isFinite(snapshot.process[key]) && snapshot.process[key] >= 0, key);
  }
});

test('recent health tracks the operational window and route cardinality stays bounded', () => {
  const before = metricsSnapshot();
  recordRequest(500, 700, 'GET /api/v1/jobs/550e8400-e29b-41d4-a716-446655440000');
  recordRequest(200, 20, 'GET /api/v1/jobs/550e8400-e29b-41d4-a716-446655440001');
  const after = metricsSnapshot();
  assert.equal(after.recentHealth.windowSeconds, 300);
  assert.ok(after.recentHealth.requests >= before.recentHealth.requests + 2);
  assert.ok(after.recentHealth.errors5xx >= before.recentHealth.errors5xx + 1);
  assert.ok(after.recentHealth.slow >= 1);
  assert.ok(after.routes['GET /api/v1/jobs/:id']);
});


test('route telemetry remains bounded even with high-cardinality paths', () => {
  for (let i = 0; i < 1200; i += 1) {
    recordRequest(200, 1, `GET /api/v1/jobs/custom-slug-${i}`);
  }
  const snapshot = metricsSnapshot();
  assert.ok(Object.keys(snapshot.routes).length <= 100);
  assert.ok(snapshot.requests > 1200);
});

test('operational gate enforces p95 and p99 latency budgets', () => {
  const source = fs.readFileSync(new URL('../../tools/staging-operational-gate.mjs', import.meta.url), 'utf8');
  assert.match(source, /STAGING_MAX_P95_MS/);
  assert.match(source, /STAGING_MAX_P99_MS/);
  assert.match(source, /data\.latency\?\.p95/);
  assert.match(source, /data\.latency\?\.p99/);
});

test('WAVE11 provides trace context and optional HTTPS alert delivery', () => {
  const tracing = fs.readFileSync(new URL('../src/tracing.js', import.meta.url), 'utf8');
  const alerting = fs.readFileSync(new URL('../src/alerting.js', import.meta.url), 'utf8');
  assert.match(tracing, /traceparent/);
  assert.match(tracing, /crypto\.randomBytes/);
  const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  assert.match(config, /ALERT_WEBHOOK/);
  assert.match(config, /alertWebhookUrl/);
  assert.match(config, /startsWith\('https:\/\/'\)/);
  assert.match(alerting, /COOLDOWN_MS/);
});

test('observability exposes bounded slow-route summaries', () => {
  const source = fs.readFileSync(new URL('../src/observability.js', import.meta.url), 'utf8');
  assert.match(source, /slowestRoutes/);
  assert.match(source, /slowRequests/);
  assert.match(source, /slice\(0,10\)/);
});
