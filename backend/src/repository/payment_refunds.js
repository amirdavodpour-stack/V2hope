import crypto from 'node:crypto';
import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { config } from '../config.js';
import { fundingJournal, releaseJournal, payoutJournal, refundJournal, calculatePaymentBreakdown } from '../financial.js';
import { jobFromRow, offerFromRow, paymentFromRow } from './mappers.js';

export async function createRefundAtomic({jobId,paymentId,ownerId,amount,id,idempotencyKey,createdAt}) {
  return withSqlTransaction(async(client)=>{
    if (idempotencyKey) {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 918273645))`, [`refund:${paymentId}:${idempotencyKey}`]);
    }
    const {rows:jr}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`,[jobId]);
    if(!jr[0]) return null;
    if(jr[0].owner_id!==ownerId){const e=new Error('FORBIDDEN');e.code='FORBIDDEN';throw e;}
    const {rows:pr}=await client.query(`SELECT * FROM payments WHERE id=$1 AND job_id=$2 FOR UPDATE`,[paymentId,jobId]);
    const payment=pr[0]; if(!payment){const e=new Error('PAYMENT_NOT_FOUND');e.code='PAYMENT_NOT_FOUND';throw e;}
    if(payment.status!=='HELD'){const e=new Error('INVALID_PAYMENT_STATE');e.code='INVALID_PAYMENT_STATE';throw e;}
    const refundAmount=Number(amount || payment.amount); if(refundAmount!==Number(payment.amount)){const e=new Error('PARTIAL_REFUND_UNSUPPORTED');e.code='PARTIAL_REFUND_UNSUPPORTED';throw e;}
    let refundRow = null;
    if (idempotencyKey) {
      const prior = await client.query(`SELECT * FROM refunds WHERE payment_id=$1 AND idempotency_key=$2 FOR UPDATE`, [paymentId, idempotencyKey]);
      refundRow = prior.rows[0] || null;
      if (refundRow?.status === 'REFUNDED') return { refund: refundRow, payment };
      if (refundRow?.status === 'PENDING') return { refund: refundRow, payment:{...payment,status:'REFUND_PENDING'} };
      // A terminal provider failure must be retryable with the same semantic
      // operation key. Reopen the existing refund row instead of creating a
      // second financial operation for the same request.
      if (refundRow?.status === 'FAILED') {
        const { rows: reopened } = await client.query(
          `UPDATE refunds SET status='PENDING',provider_ref=NULL,updated_at=$2 WHERE id=$1 RETURNING *`,
          [refundRow.id, createdAt],
        );
        refundRow = reopened[0];
      }
    }
    if (!refundRow) {
      const {rows:rr}=await client.query(`INSERT INTO refunds(id,payment_id,amount,status,provider_ref,idempotency_key,created_at,updated_at) VALUES($1,$2,$3,'PENDING',NULL,$4,$5,$5) RETURNING *`,[id,paymentId,refundAmount,idempotencyKey||null,createdAt]);
      refundRow = rr[0];
    }
    await client.query(`UPDATE payments SET status='REFUND_PENDING',updated_at=$2 WHERE id=$1`,[paymentId,createdAt]);
    const dedupe=`PAYMENT_REFUND:${paymentId}`;
    const {rows:ev}=await client.query(`INSERT INTO outbox_events(id,event_type,aggregate_type,aggregate_id,dedupe_key,payload,status,attempts,available_at,created_at) VALUES(gen_random_uuid(),'PAYMENT_REFUND','payment',$1,$2,$3::jsonb,'PENDING',0,NOW(),NOW()) ON CONFLICT(dedupe_key) DO UPDATE SET status=CASE WHEN outbox_events.status='DONE' THEN outbox_events.status ELSE 'PENDING' END,available_at=CASE WHEN outbox_events.status='DONE' THEN outbox_events.available_at ELSE NOW() END RETURNING *`,[paymentId,dedupe,JSON.stringify({jobId,ownerId,paymentId,refundId:id,providerRef:payment.provider_ref,idempotencyKey:idempotencyKey||`refund:${id}`})]);
    return {refund:refundRow,payment:{...payment,status:'REFUND_PENDING'},outboxEvent:{id:ev[0].id}};
  });
}
export async function completePaymentRefundOutbox({eventId,jobId,paymentId,refundId,providerRef,actorId,leaseToken}) {
  return withSqlTransaction(async(client)=>{
    const {rows:er}=await client.query(`SELECT lease_token FROM outbox_events WHERE id=$1 FOR UPDATE`,[eventId]);
    if(!er[0])return {completed:false,reason:'OUTBOX_NOT_FOUND'};
    if(leaseToken && String(er[0].lease_token)!==String(leaseToken))return {completed:false,reason:'STALE_LEASE'};
    const {rows:pr}=await client.query(`SELECT p.*,j.provider_id,j.status AS job_status FROM payments p JOIN jobs j ON j.id=p.job_id WHERE p.id=$1 AND p.job_id=$2 FOR UPDATE`,[paymentId,jobId]);
    const payment=pr[0]; if(!payment)return {completed:false,reason:'PAYMENT_NOT_FOUND'};
    const {rows:rr}=await client.query(`SELECT * FROM refunds WHERE id=$1 AND payment_id=$2 FOR UPDATE`,[refundId,paymentId]); const refund=rr[0]; if(!refund)return {completed:false,reason:'REFUND_NOT_FOUND'};
    if(payment.status==='REFUNDED' && refund.status==='REFUNDED'){await client.query(`UPDATE outbox_events SET status='DONE',processed_at=COALESCE(processed_at,NOW()),locked_at=NULL,last_error=NULL WHERE id=$1`,[eventId]);return {completed:true,alreadyDone:true};}
    if(payment.status!=='REFUND_PENDING' || refund.status!=='PENDING'){return {completed:false,reason:'INVALID_REFUND_STATE'};}
    const breakdown={baseAmount:Number(payment.base_amount||payment.amount),employerFee:Number(payment.employer_fee||0),workerFee:Number(payment.worker_fee||0),platformFee:Number(payment.platform_fee||0),employerCharge:Number(payment.employer_charge||payment.amount),providerPayout:Number(payment.provider_payout||payment.amount),currency:payment.currency||'USD',policyVersion:payment.fee_policy_version||'legacy',kind:'JOB'};
    await client.query(`UPDATE refunds SET status='REFUNDED',provider_ref=$2,updated_at=NOW() WHERE id=$1`,[refundId,providerRef]);
    await client.query(`UPDATE payments SET status='REFUNDED',provider_ref=$2,updated_at=NOW() WHERE id=$1`,[paymentId,payment.provider_ref]);
    await client.query(`UPDATE jobs SET status=CASE WHEN provider_id IS NULL THEN 'PUBLISHED' ELSE 'ASSIGNED' END,updated_at=NOW() WHERE id=$1`,[jobId]);
    const journalId=crypto.randomUUID(); for(const entry of refundJournal(breakdown)) await client.query(`INSERT INTO ledger_entries(id,journal_id,reference_type,reference_id,account,debit,credit,currency,created_at) VALUES($1,$2,'PAYMENT_REFUND',$3,$4,$5,$6,$7,NOW())`,[crypto.randomUUID(),journalId,paymentId,entry.account,entry.debit,entry.credit,breakdown.currency]);
    await client.query(`INSERT INTO audit_logs(id,action,actor_id,entity_type,entity_id,meta,created_at) VALUES($1,'PAYMENT_REFUND',$2,'payment',$3,$4::jsonb,NOW())`,[crypto.randomUUID(),actorId,paymentId,JSON.stringify({jobId,refundId,eventId,providerRef})]);
    await client.query(`UPDATE outbox_events SET status='DONE',processed_at=NOW(),locked_at=NULL,last_error=NULL WHERE id=$1`,[eventId]);
    return {completed:true,alreadyDone:false};
  });
}
