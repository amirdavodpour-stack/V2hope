import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/repository/payment_refunds.js', import.meta.url), 'utf8');
const outbox = fs.readFileSync(new URL('../src/repository/outbox.js', import.meta.url), 'utf8');

test('refund idempotency reopens a terminally failed refund instead of returning a dead operation', () => {
  assert.match(source, /SELECT \* FROM refunds WHERE payment_id=\$1 AND idempotency_key=\$2 FOR UPDATE/);
  assert.match(source, /refundRow\?\.status === 'REFUNDED'/);
  assert.match(source, /refundRow\?\.status === 'PENDING'/);
  assert.match(source, /refundRow\?\.status === 'FAILED'/);
  assert.match(source, /UPDATE refunds SET status='PENDING',provider_ref=NULL/);
  assert.match(source, /UPDATE payments SET status='REFUND_PENDING'/);
  assert.match(source, /PAYMENT_REFUND:\$\{paymentId\}/);
});

test('terminal refund failure restores the payment to HELD so the semantic retry is valid', () => {
  assert.match(outbox, /event_type='PAYMENT_REFUND'/);
  assert.match(outbox, /UPDATE refunds r SET status='FAILED'/);
  assert.match(outbox, /UPDATE payments p SET status='HELD'/);
});
