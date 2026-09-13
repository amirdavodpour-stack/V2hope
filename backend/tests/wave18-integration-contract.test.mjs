import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

test('wave18 provider simulator is staging-only and exposes payment/notification endpoints', () => {
  const p = path.join(root, 'staging', 'providers', 'provider-simulator.mjs');
  const text = fs.readFileSync(p, 'utf8');
  assert.match(text, /https\.createServer/);
  for (const endpoint of ['/create', '/release', '/refund', '/push', '/email']) assert.match(text, new RegExp(endpoint.replace('/', '\\/')));
  assert.match(text, /idempotency-key/);
});

test('wave18 removes stale backup artifact from source tree', () => {
  assert.equal(fs.existsSync(path.join(root, 'src', 'outbox_worker.js.bak')), false);
});
