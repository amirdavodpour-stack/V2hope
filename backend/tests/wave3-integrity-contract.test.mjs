import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schema = fs.readFileSync(path.join(process.cwd(),'src/db/schema.js'),'utf8');
const payments = ['payment_funding.js','payment_refunds.js','payment_webhooks.js'].map((name) => fs.readFileSync(path.join(process.cwd(),'src/repository',name),'utf8')).join('\n');

test('Wave 3: critical money operations serialize idempotency keys with transaction-scoped advisory locks', () => {
  assert.match(payments, /pg_advisory_xact_lock\(hashtextextended\(\$1, 918273645\)\)/);
  assert.match(payments, /`payment:\$\{payerId\}:\$\{idempotencyKey\}`/);
  assert.match(payments, /`refund:\$\{paymentId\}:\$\{idempotencyKey\}`/);
});

test('Wave 3: webhook dedupe is conflict-safe without aborting the transaction', () => {
  assert.match(payments, /ON CONFLICT\(event_id\) DO NOTHING RETURNING payment_id/);
  assert.doesNotMatch(payments, /catch \(error\).*payment_webhook_events/i);
});

test('Wave 3: PostgreSQL schema enforces financial state and deferred journal balance', () => {
  assert.match(schema, /payments_status_chk/);
  assert.match(schema, /refunds_status_chk/);
  assert.match(schema, /ledger_journal_balance_deferred/);
  assert.match(schema, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(schema, /ERRCODE='23514'/);
});
