import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentBreakdown, fundingJournal, releaseJournal, payoutJournal, refundJournal, assertBalanced } from '../src/financial.js';

test('mission fee policy is exact to cents', () => {
  const b = calculatePaymentBreakdown('MISSION', 1000000);
  assert.deepEqual({employerFee:b.employerFee,workerFee:b.workerFee,platformFee:b.platformFee,employerCharge:b.employerCharge,providerPayout:b.providerPayout}, {employerFee:100000,workerFee:100000,platformFee:200000,employerCharge:1100000,providerPayout:900000});
  assertBalanced(fundingJournal(b));
  assertBalanced(refundJournal(b));
});

test('job fee policy charges thirty percent of month one and preserves salary payout', () => {
  const b = calculatePaymentBreakdown('JOB', 30000000);
  assert.deepEqual({employerFee:b.employerFee,workerFee:b.workerFee,platformFee:b.platformFee,employerCharge:b.employerCharge,providerPayout:b.providerPayout}, {employerFee:9000000,workerFee:0,platformFee:9000000,employerCharge:39000000,providerPayout:30000000});
  assertBalanced(fundingJournal(b));
});

test('release then payout journals remain balanced independently', () => {
  const b = calculatePaymentBreakdown('MISSION', 12345.67);
  assertBalanced(releaseJournal(b));
  assertBalanced(payoutJournal(b));
});

test('unsupported kind falls back to job semantics only when explicitly named JOB', () => {
  const b = calculatePaymentBreakdown('JOB', 1);
  assert.equal(b.workerFee, 0);
  assert.equal(b.platformFee, 0.3);
});


test('financial fee calculation uses integer cents for float-sensitive amounts', () => {
  const mission = calculatePaymentBreakdown('MISSION', '19.99');
  assert.deepEqual({
    baseAmount: mission.baseAmount,
    employerFee: mission.employerFee,
    workerFee: mission.workerFee,
    platformFee: mission.platformFee,
    employerCharge: mission.employerCharge,
    providerPayout: mission.providerPayout,
  }, {baseAmount:19.99, employerFee:2, workerFee:2, platformFee:4, employerCharge:21.99, providerPayout:17.99});

  const job = calculatePaymentBreakdown('JOB', '0.29');
  assert.deepEqual({employerFee:job.employerFee, workerFee:job.workerFee, employerCharge:job.employerCharge, providerPayout:job.providerPayout}, {employerFee:0.09, workerFee:0, employerCharge:0.38, providerPayout:0.29});
});
