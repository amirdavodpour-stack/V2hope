import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileSettlement, reconcileBatch } from '../src/financial_reconciliation.js';

test('reconcileSettlement matches monetary values at cent precision', () => {
  assert.deepEqual(reconcileSettlement({paymentId:'p1',amount:'100.005',currency:'USD',status:'RELEASED',providerRef:'r1'}, {paymentId:'p1',amount:100.01,currency:'USD',status:'released',providerRef:'r1'}), {status:'MATCH',issues:[]});
});

test('reconcileSettlement reports critical divergence', () => {
  const result = reconcileSettlement({paymentId:'p1',amount:100,currency:'USD',status:'RELEASED',providerRef:'r1'}, {paymentId:'p1',amount:90,currency:'EUR',status:'FAILED',providerRef:'r2'});
  assert.equal(result.status,'MISMATCH');
  assert.deepEqual(result.issues,['AMOUNT_MISMATCH','CURRENCY_MISMATCH','STATUS_MISMATCH','PROVIDER_REF_MISMATCH']);
});

test('reconcileBatch detects missing records on either side', () => {
  const result = reconcileBatch([{paymentId:'p1',amount:10,currency:'USD',status:'RELEASED'}, {paymentId:'p2',amount:20,currency:'USD',status:'RELEASED'}], [{paymentId:'p1',amount:10,currency:'USD',status:'RELEASED'}, {paymentId:'p3',amount:30,currency:'USD',status:'RELEASED'}]);
  assert.equal(result.total,3);
  assert.equal(result.matched,1);
  assert.equal(result.mismatches.length,2);
  assert.deepEqual(result.mismatches.map(x=>x.status).sort(), ['MISSING_INTERNAL','MISSING_PROVIDER']);
});
