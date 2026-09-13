import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';

const server = createServer();
let base;
before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] || 0;
}

test('load smoke: 500 health/live requests complete without server errors', async () => {
  const started = Date.now();
  const latencies = [];
  const responses = await Promise.all(Array.from({ length: 500 }, async (_, i) => {
    const t = performance.now();
    const r = await fetch(base + (i % 2 ? '/health' : '/live'));
    latencies.push(performance.now() - t);
    return r;
  }));
  const elapsed = Date.now() - started;
  const serverErrors = responses.filter(r => r.status >= 500).length;
  assert.equal(responses.length, 500);
  assert.equal(serverErrors, 0);
  assert.ok(elapsed < 15000, `500 requests took ${elapsed}ms`);
  assert.ok(percentile(latencies, 0.95) < 5000, `p95=${percentile(latencies, 0.95).toFixed(1)}ms`);
});
