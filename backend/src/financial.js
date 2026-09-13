import { config } from './config.js';

export const FEE_POLICY_VERSION = '2026-08-v1';
export const ACCOUNT = Object.freeze({
  PLATFORM_CASH: 'PLATFORM_CASH',
  ESCROW_LIABILITY: 'ESCROW_LIABILITY',
  USER_PAYABLE: 'USER_PAYABLE',
  PLATFORM_FEE_REVENUE: 'PLATFORM_FEE_REVENUE',
});

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function moneyToCents(value) {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw)) throw new Error('INVALID_AMOUNT');
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100_000_000_000) throw new Error('INVALID_AMOUNT');
  return cents;
}

const centsToMoney = (cents) => cents / 100;

export function calculatePaymentBreakdown(kind, baseAmount) {
  const amountCents = moneyToCents(baseAmount);
  const normalizedKind = String(kind || '').toUpperCase();
  const employerFeeRate = normalizedKind === 'MISSION' ? 10 : 30;
  const workerFeeRate = normalizedKind === 'MISSION' ? 10 : 0;
  const employerFeeCents = Math.round(amountCents * employerFeeRate / 100);
  const workerFeeCents = Math.round(amountCents * workerFeeRate / 100);
  const platformFeeCents = employerFeeCents + workerFeeCents;
  const employerChargeCents = amountCents + employerFeeCents;
  const providerPayoutCents = amountCents - workerFeeCents;
  const amount = centsToMoney(amountCents);
  const employerFee = centsToMoney(employerFeeCents);
  const workerFee = centsToMoney(workerFeeCents);
  const platformFee = centsToMoney(platformFeeCents);
  const employerCharge = centsToMoney(employerChargeCents);
  const providerPayout = centsToMoney(providerPayoutCents);
  return {
    policyVersion: FEE_POLICY_VERSION,
    kind: normalizedKind,
    baseAmount: roundMoney(amount),
    employerFeeRate,
    workerFeeRate,
    employerFee,
    workerFee,
    platformFee,
    employerCharge,
    providerPayout,
    currency: config.paymentCurrency,
  };
}

export function assertBalanced(entries) {
  const debit = roundMoney(entries.reduce((sum, e) => sum + Number(e.debit || 0), 0));
  const credit = roundMoney(entries.reduce((sum, e) => sum + Number(e.credit || 0), 0));
  if (debit !== credit) throw new Error(`UNBALANCED_JOURNAL:${debit}:${credit}`);
  return true;
}

export function fundingJournal(breakdown) {
  const entries = [
    { account: ACCOUNT.PLATFORM_CASH, debit: breakdown.employerCharge, credit: 0 },
    { account: ACCOUNT.ESCROW_LIABILITY, debit: 0, credit: breakdown.providerPayout },
    { account: ACCOUNT.PLATFORM_FEE_REVENUE, debit: 0, credit: breakdown.platformFee },
  ];
  assertBalanced(entries);
  return entries;
}

export function releaseJournal(breakdown) {
  const entries = [
    { account: ACCOUNT.ESCROW_LIABILITY, debit: breakdown.providerPayout, credit: 0 },
    { account: ACCOUNT.USER_PAYABLE, debit: 0, credit: breakdown.providerPayout },
  ];
  assertBalanced(entries);
  return entries;
}

export function payoutJournal(breakdown) {
  const entries = [
    { account: ACCOUNT.USER_PAYABLE, debit: breakdown.providerPayout, credit: 0 },
    { account: ACCOUNT.PLATFORM_CASH, debit: 0, credit: breakdown.providerPayout },
  ];
  assertBalanced(entries);
  return entries;
}

export function refundJournal(breakdown) {
  const entries = [
    { account: ACCOUNT.ESCROW_LIABILITY, debit: breakdown.providerPayout, credit: 0 },
    { account: ACCOUNT.PLATFORM_FEE_REVENUE, debit: breakdown.platformFee, credit: 0 },
    { account: ACCOUNT.PLATFORM_CASH, debit: 0, credit: breakdown.employerCharge },
  ];
  assertBalanced(entries);
  return entries;
}
