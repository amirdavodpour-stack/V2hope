import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outbox = fs.readFileSync(path.join(root, 'src/repository/outbox.js'), 'utf8');
const state = fs.readFileSync(path.join(root, 'src/domain/payment_state.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'src/db/schema.js'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src/routes/payment_routes.js'), 'utf8');

test('release failures are explicit and retryable', () => {
  assert.match(state, /RELEASE_PENDING:\s*\['RELEASED',\s*'RELEASE_FAILED'\]/);
  assert.match(state, /RELEASE_FAILED:\s*\['RELEASE_PENDING'\]/);
  assert.match(outbox, /status='RELEASE_FAILED'/);
  assert.match(outbox, /\['RELEASE_PENDING','RELEASE_FAILED'\]\.includes\(payment\.status\)/);
  assert.match(outbox, /status='RELEASE_PENDING',updated_at=NOW\(\) WHERE id=\$1/);
  assert.match(route, /\['RELEASE_PENDING','RELEASE_FAILED'\]\.includes\(payment\.status\)/);
});

test('database payment status constraint includes release recovery state', () => {
  assert.match(schema, /'RELEASE_PENDING','RELEASE_FAILED','RELEASED'/);
});

test('release retry reuses the same outbox dedupe key', () => {
  assert.match(outbox, /ON CONFLICT\(dedupe_key\) DO UPDATE SET/);
  assert.match(outbox, /status=CASE WHEN outbox_events\.status='DONE' THEN outbox_events\.status ELSE 'PENDING' END/);
});

test('terminal release failure cannot create a second ledger settlement', () => {
  const failureBlock = outbox.slice(outbox.indexOf('export async function failOutboxEvent'));
  assert.match(failureBlock, /PAYMENT_RELEASE/);
  assert.doesNotMatch(failureBlock, /INSERT INTO ledger_entries/);
  assert.doesNotMatch(failureBlock, /INSERT INTO settlements/);
});
