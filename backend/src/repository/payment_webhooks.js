import crypto from 'node:crypto';
import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { fundingJournal, releaseJournal, payoutJournal, refundJournal } from '../financial.js';

const RELEASE_STATES = new Set(['RELEASE_PENDING', 'RELEASE_FAILED']);

function providerRefMatches(payment, providerRef) {
  if (!providerRef) return true;
  if (!payment?.provider_ref) return true;
  return String(payment.provider_ref) === String(providerRef);
}

function conflict(code, message) {
  const e = new Error(code);
  e.code = code;
  e.status = 409;
  e.message = message;
  return e;
}

export async function applyPaymentWebhookAtomic({eventId,eventType,paymentId,providerRef,payload}) {
  return withSqlTransaction(async(client)=>{
    const prior=await client.query(`SELECT * FROM payment_webhook_events WHERE event_id=$1`,[eventId]);
    if(prior.rows[0]) return {processed:true,duplicate:true,paymentId:prior.rows[0].payment_id};

    // Resolve the aggregate before recording the event. An unknown aggregate
    // must rollback the entire transaction so the provider can safely retry.
    const {rows:pr}=await client.query(`SELECT * FROM payments WHERE id=$1 FOR UPDATE`,[paymentId]);
    if(!pr[0]) throw conflict('PAYMENT_NOT_FOUND','Payment not found');
    const p=pr[0];

    if (!providerRefMatches(p, providerRef) && eventType !== 'PAYMENT_REFUNDED') {
      throw conflict('PROVIDER_REF_MISMATCH','Webhook provider reference does not match the payment');
    }

    const {rows:insertedEvents}=await client.query(
      `INSERT INTO payment_webhook_events(id,event_id,event_type,payment_id,provider_ref,payload,processed_at,created_at)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,NOW(),NOW())
       ON CONFLICT(event_id) DO NOTHING RETURNING payment_id`,
      [crypto.randomUUID(),eventId,eventType,paymentId,providerRef || null,JSON.stringify(payload||{})]
    );
    if (!insertedEvents.length) {
      const duplicate = await client.query(`SELECT payment_id FROM payment_webhook_events WHERE event_id=$1`,[eventId]);
      return {processed:true,duplicate:true,paymentId:duplicate.rows[0]?.payment_id || null};
    }

    if(eventType==='PAYMENT_HELD' && p.status==='HOLD_PENDING') {
      await client.query(`UPDATE payments SET status='HELD',provider_ref=$2,updated_at=NOW() WHERE id=$1`,[paymentId,providerRef]);
    } else if(eventType==='PAYMENT_RELEASED' && RELEASE_STATES.has(p.status)) {
      await client.query(`UPDATE payments SET status='RELEASED',updated_at=NOW() WHERE id=$1`,[paymentId]);
      await client.query(`UPDATE jobs SET status='SETTLED',updated_at=NOW() WHERE id=$1`,[p.job_id]);
      const b={baseAmount:Number(p.base_amount||p.amount),employerFee:Number(p.employer_fee||0),workerFee:Number(p.worker_fee||0),platformFee:Number(p.platform_fee||0),employerCharge:Number(p.employer_charge||p.amount),providerPayout:Number(p.provider_payout||p.amount),currency:p.currency||'USD'};
      // The webhook event itself is the idempotency boundary. Only this newly
      // inserted event is allowed to create the settlement journal.
      for(const journal of [releaseJournal(b),payoutJournal(b)]){
        const jid=crypto.randomUUID();
        for(const e of journal) await client.query(
          `INSERT INTO ledger_entries(id,journal_id,reference_type,reference_id,account,debit,credit,currency,created_at)
           VALUES($1,$2,'PAYMENT_WEBHOOK',$3,$4,$5,$6,$7,NOW())`,
          [crypto.randomUUID(),jid,paymentId,e.account,e.debit,e.credit,b.currency]
        );
      }
      await client.query(
        `INSERT INTO settlements(id,payment_id,provider_ref,amount,currency,status,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,'RELEASED',NOW(),NOW())
         ON CONFLICT(payment_id) DO UPDATE SET status='RELEASED',provider_ref=EXCLUDED.provider_ref,updated_at=NOW()`,
        [crypto.randomUUID(),paymentId,providerRef || p.provider_ref, b.providerPayout,b.currency]
      );
    } else if(eventType==='PAYMENT_REFUNDED' && p.status==='REFUND_PENDING') {
      const {rows:rr}=await client.query(`SELECT * FROM refunds WHERE payment_id=$1 AND status='PENDING' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[paymentId]);
      const refund=rr[0];
      if(!refund) throw conflict('REFUND_NOT_FOUND','Pending refund not found');
      const b={baseAmount:Number(p.base_amount||p.amount),employerFee:Number(p.employer_fee||0),workerFee:Number(p.worker_fee||0),platformFee:Number(p.platform_fee||0),employerCharge:Number(p.employer_charge||p.amount),providerPayout:Number(p.provider_payout||p.amount),currency:p.currency||'USD'};
      await client.query(`UPDATE refunds SET status='REFUNDED',provider_ref=COALESCE($2,provider_ref),updated_at=NOW() WHERE id=$1`,[refund.id,providerRef||null]);
      await client.query(`UPDATE payments SET status='REFUNDED',updated_at=NOW() WHERE id=$1`,[paymentId]);
      await client.query(`UPDATE jobs SET status=CASE WHEN provider_id IS NULL THEN 'PUBLISHED' ELSE 'ASSIGNED' END,updated_at=NOW() WHERE id=$1`,[p.job_id]);
      const jid=crypto.randomUUID();
      for(const e of refundJournal(b)) await client.query(
        `INSERT INTO ledger_entries(id,journal_id,reference_type,reference_id,account,debit,credit,currency,created_at)
         VALUES($1,$2,'PAYMENT_WEBHOOK',$3,$4,$5,$6,$7,NOW())`,
        [crypto.randomUUID(),jid,paymentId,e.account,e.debit,e.credit,b.currency]
      );
    }
    return {processed:true,duplicate:false,paymentId};
  });
}

export { RELEASE_STATES };
