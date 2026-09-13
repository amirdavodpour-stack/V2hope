import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIdempotencyPair, paymentAmountForJob, mapPaymentMutationError } from '../src/application/payment_policy.js';

test('payment policy accepts matching header/body idempotency keys', () => {
  assert.equal(validateIdempotencyPair({ headerKey: 'abc-123', bodyKey: 'abc-123', maxLength: 64 }), 'abc-123');
});

test('payment policy rejects unsafe and oversized idempotency keys', () => {
  assert.throws(() => validateIdempotencyPair({ bodyKey: 'bad key', maxLength: 64 }), /unsupported characters/i);
  assert.throws(() => validateIdempotencyPair({ bodyKey: 'x'.repeat(65), maxLength: 64 }), /too long/i);
});

test('payment policy rejects header/body mismatch', () => {
  assert.throws(() => validateIdempotencyPair({ headerKey: 'a', bodyKey: 'b', maxLength: 64 }), /must match/i);
});

test('payment amount selection is deterministic by job kind', () => {
  assert.equal(paymentAmountForJob({ kind: 'JOB', monthlySalary: 1200, budgetMax: 900 }), 1200);
  assert.equal(paymentAmountForJob({ kind: 'MISSION', budgetMax: 800, budgetMin: 500 }), 800);
  assert.throws(() => paymentAmountForJob({ kind: 'JOB', monthlySalary: 0, budgetMax: 0, budgetMin: 0 }), /budget is invalid/i);
});

test('payment mutation errors map to stable HTTP contracts', () => {
  const mapped = mapPaymentMutationError(Object.assign(new Error('x'), { code: 'INVALID_OFFER_STATE' }));
  assert.equal(mapped.status, 409);
  assert.equal(mapped.code, 'INVALID_OFFER_STATE');
  const unknown = Object.assign(new Error('unexpected'), { code: 'UNKNOWN' });
  assert.equal(mapPaymentMutationError(unknown), unknown);
});
