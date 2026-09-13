import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repo = ['core.js','payment_lifecycle.js','payment_funding.js','payment_refunds.js','outbox.js'].map((name) => fs.readFileSync(new URL(`../src/repository/${name}`, import.meta.url), 'utf8')).join('\n');

test('critical repository mutations use PostgreSQL transactions and row locks', () => {
  assert.match(repo, /export async function acceptOffer[\s\S]*SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /export async function fundJobAtomic[\s\S]*SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /fundJobAtomic[\s\S]*UPDATE offers SET status='ACCEPTED'/);
  assert.match(repo, /export async function enqueuePaymentRelease[\s\S]*SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /export async function completePaymentReleaseOutbox[\s\S]*SELECT \* FROM outbox_events WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /ON CONFLICT|idempotency_key/);
});
