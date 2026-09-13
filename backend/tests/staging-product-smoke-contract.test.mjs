import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = fs.readFileSync(path.join(root, 'tools/staging-product-smoke.mjs'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');

test('staging product smoke covers the complete core workflow', () => {
  for (const token of [
    '/auth/register',
    '/jobs',
    '/publish',
    '/offers',
    '/accept',
    '/payments/fund/',
    '/start',
    '/evidence',
    '/deliver',
    '/payments/release/',
  ]) assert.match(script, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing ${token}`);
  assert.match(workflow, /name: Staging product workflow/);
  assert.match(workflow, /node \.\.\/tools\/staging-product-smoke\.mjs/);
  assert.match(script, /payment hold/);
  assert.match(script, /payment release/);
  assert.match(script, /\[200, 201, 202\]/);
  const operational = fs.readFileSync(path.join(root, 'tools/staging-operational-gate.mjs'), 'utf8');
  assert.match(operational, /errorRate5xx/);
  assert.match(operational, /slowRequestRate/);
  assert.match(operational, /X-Metrics-Token/);
});


test('staging certification runs an actual performance smoke with bounded latency/error budgets', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
  assert.match(workflow, /name: Staging performance smoke/);
  for (const marker of [
    'PERF_BASE_URL:',
    "PERF_REQUESTS: '500'",
    "PERF_CONCURRENCY: '50'",
    "PERF_P95_BUDGET_MS: '500'",
    "PERF_P99_BUDGET_MS: '1000'",
    "PERF_MAX_5XX_RATE: '0.01'",
    'tools/perf-smoke.mjs',
  ]) {
    assert.match(workflow, marker.includes(':') ? new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : new RegExp(marker));
  }
  assert.match(workflow, /perf-smoke\.json/);
});
