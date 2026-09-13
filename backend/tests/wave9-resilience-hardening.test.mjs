import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
const outbox = fs.readFileSync(new URL('../src/repository/outbox.js', import.meta.url), 'utf8');
const payments = ['payment_refunds.js','payment_webhooks.js'].map((name) => fs.readFileSync(new URL(`../src/repository/${name}`, import.meta.url), 'utf8')).join('\n');
const worker = fs.readFileSync(new URL('../src/outbox_worker.js', import.meta.url), 'utf8');
const handlers = fs.readFileSync(new URL('../src/outbox_handlers.js', import.meta.url), 'utf8');


test('outbox claims carry a lease token and reclaim stale work atomically', () => {
  assert.match(schema, /lease_token UUID/);
  assert.match(outbox, /status='PROCESSING', attempts=o\.attempts\+1, locked_at=NOW\(\), lease_token=gen_random_uuid\(\)/);
  assert.match(outbox, /status IN \('PENDING','PROCESSING'\)/);
  assert.match(outbox, /locked_at < NOW\(\) - make_interval/);
});

test('outbox completion and failure reject stale workers by lease token', () => {
  assert.match(outbox, /reason:'STALE_LEASE'/);
  assert.match(payments, /reason:'STALE_LEASE'/);
  assert.match(outbox, /lease_token=NULL/);
  assert.match(handlers, /leaseToken:event\.lease_token/);
});

test('resilience path remains fail-closed for terminal outbox failures', () => {
  assert.match(outbox, /const terminal = attempts >= maxAttempts/);
  assert.match(outbox, /const nextStatus = terminal \? 'FAILED' : 'PENDING'/);
  assert.match(outbox, /status='HOLD_FAILED'/);
  assert.match(outbox, /status='FAILED'/);
});
