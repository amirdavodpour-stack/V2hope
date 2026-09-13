import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyField, dateOnlyField } from '../src/policies/validation.js';

test('moneyField accepts valid two-decimal monetary values without float artifacts', () => {
  for (const value of ['0.29', '1.11', '19.99', '0.07', '100.01', 19.99]) {
    assert.equal(moneyField(value, 'amount'), Number(value));
  }
});

test('moneyField rejects more than two decimal places and non-decimal forms', () => {
  for (const value of ['0.001', '1.111', '1e3', '0x10', ' 1.234 ']) {
    assert.throws(() => moneyField(value, 'amount'), /INVALID_AMOUNT|at most 2 decimal places/);
  }
});

test('dateOnlyField rejects calendar-invalid dates instead of JavaScript rollover', () => {
  for (const value of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10']) {
    assert.throws(() => dateOnlyField(value, 'applicationDeadline'), /INVALID_DEADLINE|invalid/);
  }
});

test('dateOnlyField accepts valid calendar dates and preserves canonical input', () => {
  for (const value of ['2026-02-28', '2026-03-01', '2028-02-29', '2026-12-31']) {
    assert.equal(dateOnlyField(value, 'applicationDeadline'), value);
  }
});
