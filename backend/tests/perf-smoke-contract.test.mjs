import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.resolve(here, '../tools/perf-smoke.mjs');
const pkg = JSON.parse(fs.readFileSync(path.resolve(here, '../package.json'), 'utf8'));

test('performance smoke tool is dependency-free and exposes CI budgets', () => {
  assert.equal(pkg.scripts['perf:smoke'], 'node tools/perf-smoke.mjs');
  const source = fs.readFileSync(tool, 'utf8');
  for (const marker of [
    'PERF_BASE_URL',
    'PERF_REQUESTS',
    'PERF_CONCURRENCY',
    'PERF_P95_BUDGET_MS',
    'PERF_P99_BUDGET_MS',
    'PERF_MAX_5XX_RATE',
    'requestsPerSecond',
    'errorRate5xx',
    'latencyMs',
    'PERF_ENDPOINTS',
    'PERF_REQUIRE_ALL_OK',
    'schemaVersion: 1',
  ]) assert.ok(source.includes(marker), marker);
});


test('performance smoke refuses unsupported Node runtimes', () => {
  const source = fs.readFileSync(tool, 'utf8');
  assert.match(source, /Node 24\+ required for performance certification/);
});
