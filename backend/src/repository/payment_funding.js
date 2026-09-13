import crypto from 'node:crypto';
import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { config } from '../config.js';
import { fundingJournal, releaseJournal, payoutJournal, refundJournal, calculatePaymentBreakdown } from '../financial.js';
import { jobFromRow, offerFromRow, paymentFromRow } from './mappers.js';
import { findPaymentByIdempotency } from './payment_queries.js';

export async function fundJobAtomic({jobId,payerId,payeeId,offerId=null,amount,id,idempotencyKey,createdAt,breakdown}) {
  return withSqlTransaction(async (client) => {
    if (idempotencyKey) {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 918273645))`, [`payment:${payerId}:${idempotencyKey}`]);
    }
    const {rows:jobRows}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`, [jobId]);
    const job=jobRows[0] ? jobFromRow(jobRows[0]) : null;
    if (!job) return null;
    if (job.ownerId !== payerId) { const e=new Error('FORBIDDEN');e.code='FORBIDDEN';throw e; }
    if (!['PUBLISHED','ASSIGNED','FUNDED'].includes(job.status)) { const e=new Error('INVALID_STATE');e.code='INVALID_STATE';throw e; }
    const existingRow = await client.query(`SELECT * FROM payments WHERE job_id=$1 FOR UPDATE`, [jobId]);
    if (existingRow.rows[0]) {
      const existing=paymentFromRow(existingRow.rows[0]);
      if (existing.idempotencyKey && idempotencyKey && existing.idempotencyKey !== idempotencyKey) { const e=new Error('PAYMENT_ALREADY_EXISTS');e.code='PAYMENT_ALREADY_EXISTS';throw e; }
      if (existing.status === 'HOLD_FAILED') {
        await client.query(`UPDATE payments SET status='HOLD_PENDING',idempotency_key=COALESCE(NULLIF(idempotency_key,''),NULLIF($3,'')),updated_at=$2 WHERE id=$1`, [existing.id,createdAt,idempotencyKey || null]);
        const {rows:ev}=await client.query(`
          INSERT INTO outbox_events(id,event_type,aggregate_type,aggregate_id,dedupe_key,payload,status,attempts,available_at,created_at)
          VALUES(gen_random_uuid(),'PAYMENT_CREATE_HOLD','payment',$1,$2,$3::jsonb,'PENDING',0,NOW(),NOW())
          ON CONFLICT(dedupe_key) DO UPDATE SET status='PENDING',available_at=NOW(),locked_at=NULL,last_error=NULL,processed_at=NULL
          RETURNING *`,
          [existing.id, `PAYMENT_CREATE_HOLD:${existing.id}`, JSON.stringify({ jobId, ownerId:payerId, paymentId:existing.id, amount:Number(existing.employer_charge || existing.amount), baseAmount:Number(existing.base_amount || existing.amount), currency:config.paymentCurrency, idempotencyKey:existing.idempotencyKey || idempotencyKey || `payment:${existing.id}` })]);
        return { payment:{...existing,status:'HOLD_PENDING',updatedAt:createdAt.toISOString?.() ?? createdAt}, job, outboxEvent:{id:ev[0].id,status:ev[0].status}, retry:true };
      }
      return {payment:existing,job,outboxEvent:null,created:false};
    }
    if (idempotencyKey) {
      const prior=await findPaymentByIdempotency(payerId,idempotencyKey,client);
      if (prior) {
        if (prior.jobId !== jobId || Number(prior.amount) !== Number(amount)) { const e=new Error('IDEMPOTENCY_CONFLICT'); e.code='IDEMPOTENCY_CONFLICT'; throw e; }
        return {payment:prior,job,outboxEvent:null,created:false};
      }
    }
    if (offerId) {
      const {rows:offerRows}=await client.query(`SELECT * FROM offers WHERE id=$1 AND job_id=$2 FOR UPDATE`, [offerId,jobId]);
      const selected=offerRows[0];
      if (!selected || selected.status !== 'PENDING' || selected.provider_id !== payeeId) { const e=new Error('INVALID_OFFER_STATE');e.code='INVALID_OFFER_STATE';throw e; }
      await client.query(`UPDATE offers SET status='ACCEPTED',updated_at=NOW() WHERE id=$1`, [offerId]);
      await client.query(`UPDATE offers SET status='REJECTED',updated_at=NOW() WHERE job_id=$1 AND id<>$2 AND status='PENDING'`, [jobId,offerId]);
    }
    const fees = breakdown || calculatePaymentBreakdown(job.kind || (job.jobType === 'FIXED' ? 'MISSION' : 'JOB'), amount);
    const placeholderRef = `PENDING:${id}`;
    const {rows}=await client.query(`INSERT INTO payments(id,job_id,payer_id,payee_id,amount,status,provider_ref,idempotency_key,base_amount,employer_fee,worker_fee,platform_fee,employer_charge,provider_payout,fee_policy_version,currency,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'HOLD_PENDING',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING *`, [id,jobId,payerId,payeeId,amount,placeholderRef,idempotencyKey || null,fees.baseAmount,fees.employerFee,fees.workerFee,fees.platformFee,fees.employerCharge,fees.providerPayout,fees.policyVersion,fees.currency,createdAt]);
    const {rows:job2}=await client.query(`UPDATE jobs SET status='FUNDED',updated_at=$2,provider_id=COALESCE(provider_id,$3) WHERE id=$1 RETURNING *`, [jobId,createdAt,payeeId]);
    const journalId = crypto.randomUUID();
    for (const entry of fundingJournal(fees)) await client.query(`INSERT INTO ledger_entries(id,journal_id,reference_type,reference_id,account,debit,credit,currency,created_at) VALUES($1,$2,'PAYMENT_FUND',$3,$4,$5,$6,$7,$8)`, [crypto.randomUUID(),journalId,id,entry.account,entry.debit,entry.credit,fees.currency,createdAt]);
    const {rows:ev}=await client.query(`
      INSERT INTO outbox_events(id,event_type,aggregate_type,aggregate_id,dedupe_key,payload,status,attempts,available_at,created_at)
      VALUES(gen_random_uuid(),'PAYMENT_CREATE_HOLD','payment',$1,$2,$3::jsonb,'PENDING',0,NOW(),NOW())
      RETURNING *`,
      [id, `PAYMENT_CREATE_HOLD:${id}`, JSON.stringify({ jobId, ownerId:payerId, paymentId:id, amount:Number(fees.employerCharge), baseAmount:Number(fees.baseAmount), currency:fees.currency, idempotencyKey:idempotencyKey || `payment:${id}` })]);
    await client.query(`INSERT INTO audit_logs(id,action,actor_id,entity_type,entity_id,meta,created_at) VALUES($1,'PAYMENT_FUND',$2,'payment',$3,$4::jsonb,$5)`, [crypto.randomUUID(), payerId, id, JSON.stringify({jobId,outboxEventId:ev[0].id}), createdAt]);
    return {payment:paymentFromRow(rows[0]),job:jobFromRow(job2[0]),outboxEvent:{id:ev[0].id,status:ev[0].status},created:true};
  });
}
