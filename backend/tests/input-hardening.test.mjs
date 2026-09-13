import test from 'node:test';
import assert from 'node:assert/strict';
import { stringField } from '../src/policies/validation.js';

test('stringField rejects structured JSON instead of coercing it', () => {
  assert.throws(
    () => stringField({ value: 'password' }, 'password', { required: true }),
    (error) => error.code === 'INVALID_FIELD' && error.status === 400,
  );
  assert.throws(
    () => stringField(['display-name'], 'displayName', { required: true }),
    (error) => error.code === 'INVALID_FIELD' && error.status === 400,
  );
});

test('stringField trims and enforces bounded user input', () => {
  assert.equal(stringField('  Amir  ', 'displayName', { min: 1, max: 20, required: true }), 'Amir');
  assert.throws(
    () => stringField('x'.repeat(21), 'displayName', { min: 1, max: 20, required: true }),
    (error) => error.code === 'INVALID_FIELD' && error.status === 400,
  );
});