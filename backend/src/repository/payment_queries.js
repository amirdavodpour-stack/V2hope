import { requirePool } from './context.js';
import { config } from '../config.js';
import { paymentFromRow } from './mappers.js';

export async function findPaymentById(paymentId, client=requirePool()) {
  const {rows}=await client.query(`SELECT * FROM payments WHERE id=$1`,[paymentId]); return rows[0]?paymentFromRow(rows[0]):null;
}
export async function findPaymentByJob(jobId, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM payments WHERE job_id=$1`, [jobId]);
  return rows[0] ? paymentFromRow(rows[0]) : null;
}
export async function findPaymentByIdempotency(payerId, key, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM payments WHERE payer_id=$1 AND idempotency_key=$2`, [payerId,key]);
  return rows[0] ? paymentFromRow(rows[0]) : null;
}
export async function getAdminFinancialSummary() {
  const { rows } = await requirePool().query(`SELECT COUNT(*)::int AS payments, COUNT(*) FILTER (WHERE status IN ('HOLD_PENDING','REFUND_PENDING','RELEASE_PENDING','RELEASE_FAILED'))::int AS pending, COUNT(*) FILTER (WHERE status='HELD')::int AS held, COUNT(*) FILTER (WHERE status='RELEASED')::int AS released, COUNT(*) FILTER (WHERE status='REFUNDED')::int AS refunded, COALESCE(SUM(platform_fee),0) AS platform_fees, COALESCE(SUM(employer_charge),0) AS employer_charges, COALESCE(SUM(provider_payout),0) AS provider_payouts FROM payments`);
  const counts = rows[0];
  const [{rows:rr},{rows:sr},{rows:lr}] = await Promise.all([requirePool().query(`SELECT COUNT(*)::int AS count FROM refunds`),requirePool().query(`SELECT COUNT(*)::int AS count FROM settlements`),requirePool().query(`SELECT COUNT(*)::int AS count FROM ledger_entries`)]);
  return {payments:counts.payments,pending:counts.pending,held:counts.held,released:counts.released,refunded:counts.refunded,platformFees:Number(counts.platform_fees||0),employerCharges:Number(counts.employer_charges||0),providerPayouts:Number(counts.provider_payouts||0),refunds:Number(rr[0].count||0),settlements:Number(sr[0].count||0),ledgerEntries:Number(lr[0].count||0),currency:config.paymentCurrency};
}
