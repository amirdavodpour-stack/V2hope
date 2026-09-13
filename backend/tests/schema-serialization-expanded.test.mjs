import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchema } from '../src/db/schema.js';
import { tableColumns, toDbRow, fromDbRow } from '../src/db/serialization.js';

test('schema bootstrap emits idempotent DDL and protects core financial/outbox invariants', async () => {
  const queries = [];
  const client = { query: async (sql) => { queries.push(sql); } };
  await createSchema(client);
  const ddl = queries.join('\n');
  assert.equal(queries.length, 1, 'schema bootstrap should execute as one transaction-safe DDL batch in the current implementation');
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS payments/i);
  assert.match(ddl, /payments_idempotency_uq/i);
  assert.match(ddl, /payments_status_chk/i);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS ledger_entries/i);
  assert.match(ddl, /ledger_journal_balance_deferred/i);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS payment_webhook_events/i);
  assert.match(ddl, /event_id TEXT NOT NULL UNIQUE/i);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS upload_intents/i);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS outbox_events/i);
  assert.match(ddl, /dedupe_key TEXT NULL UNIQUE/i);
});

test('serialization declares every persisted collection and preserves security-sensitive defaults', () => {
  for (const collection of [
    'users','providers','refresh_tokens','reset_tokens','categories','jobs','offers','job_applications',
    'payments','ledger_entries','settlements','refunds','payment_webhook_events','evidence','uploads',
    'upload_intents','audit_logs','notifications','notification_preferences','notification_devices',
    'analytics_events','crash_reports','trust_reports',
  ]) assert.ok(Array.isArray(tableColumns[collection]), `missing columns for ${collection}`);

  const now = new Date('2026-01-02T03:04:05.000Z');
  const user = {id:'u1', email:'u@example.com', passwordHash:'hash', displayName:'User', role:'USER', status:'ACTIVE', sessionVersion:0, createdAt:now};
  const row = toDbRow('users', user);
  assert.equal(row[6], 0);
  assert.equal(row[1], user.email);
  assert.equal(fromDbRow('users', {
    id:'u1', email:'u@example.com', password_hash:'hash', display_name:'User', role:'USER', status:'ACTIVE', session_version:null, created_at:now,
  }).sessionVersion, 0);

  const reset = toDbRow('resetTokens', {id:'r1', userId:'u1', tokenHash:'h', expiresAt:now, usedAt:null, createdAt:now});
  assert.match(String(reset[3]), /^[0-9a-f-]{36}$/i);

  const payment = toDbRow('payments', {id:'p1', jobId:'j1', payerId:'u1', payeeId:'u2', amount:10, status:'HELD', createdAt:now, updatedAt:now});
  assert.equal(payment[8], 10);
  assert.equal(payment[9], 0);
  assert.equal(payment[10], 0);
});
