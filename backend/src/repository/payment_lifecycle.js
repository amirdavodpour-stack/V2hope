import crypto from 'node:crypto';
import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { config } from '../config.js';
import { fundingJournal, releaseJournal, payoutJournal, refundJournal, calculatePaymentBreakdown } from '../financial.js';
import { jobFromRow, offerFromRow, paymentFromRow } from './mappers.js';
import { findOfferById } from './core.js';

export async function updateJobSimple(id,expectedStatuses,patch) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`,[id]); if(!rows[0]) return null; const job=jobFromRow(rows[0]);
    if(!expectedStatuses.includes(job.status)){const e=new Error('INVALID_STATE');e.code='INVALID_STATE';throw e;}
    const allowed={providerId:'provider_id',status:'status',updatedAt:'updated_at',publishedAt:'published_at'}; const fields=Object.keys(patch).filter(k=>allowed[k]);
    if(!fields.length) return job;
    const values=[id,...fields.map(k=>patch[k])]; const sets=fields.map((k,i)=>`${allowed[k]}=$${i+2}`);
    const {rows:updated}=await client.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 RETURNING *`,values); return jobFromRow(updated[0]);
  });
}
export async function transitionJobWithPayment(id,expectedStatuses,jobPatch,paymentStatus) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`,[id]); if(!rows[0]) return null; const job=jobFromRow(rows[0]);
    if(!expectedStatuses.includes(job.status)){const e=new Error('INVALID_STATE');e.code='INVALID_STATE';throw e;}
    const {rows:p}=await client.query(`SELECT * FROM payments WHERE job_id=$1 FOR UPDATE`,[id]); const payment=p[0]?paymentFromRow(p[0]):null;
    if(!payment || (paymentStatus && payment.status!==paymentStatus)){const e=new Error('INVALID_PAYMENT_STATE');e.code='INVALID_PAYMENT_STATE';throw e;}
    const allowed={status:'status',updatedAt:'updated_at'}; const fields=Object.keys(jobPatch).filter(k=>allowed[k]); const vals=[id,...fields.map(k=>jobPatch[k])]; const sets=fields.map((k,i)=>`${allowed[k]}=$${i+2}`);
    const {rows:uj}=await client.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 RETURNING *`,vals);
    const {rows:up}=await client.query(`UPDATE payments SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,[payment.id,paymentStatus==='HELD'?'RELEASE_PENDING':paymentStatus]);
    return {job:jobFromRow(uj[0]),payment:paymentFromRow(up[0])};
  });
}
export async function acceptOffer(offerId, ownerId) {
  return withSqlTransaction(async (client) => {
    const offer = await findOfferById(offerId, client);
    if (!offer) return null;
    // BUG FIX: the job row must be locked (SELECT ... FOR UPDATE) BEFORE
    // its status is checked, not after. The previous version read job.status
    // via a plain, non-locking findJobById(), decided PUBLISHED was fine,
    // and only then acquired the lock -- so two concurrent "accept a
    // different offer on the same job" transactions could both pass the
    // PUBLISHED check before either committed, then both proceed to assign
    // the job (to two different offers/providers) once the lock freed up
    // in turn. This mirrors the correct lock-then-check order already used
    // by fundJobAtomic()/enqueuePaymentRelease() below.
    const { rows: jobRows } = await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`, [offer.jobId]);
    if (!jobRows[0]) return null;
    const job = jobFromRow(jobRows[0]);
    if (job.ownerId !== ownerId) { const e = new Error('FORBIDDEN'); e.code='FORBIDDEN'; throw e; }
    if (job.status !== 'PUBLISHED') { const e = new Error('INVALID_STATE'); e.code='INVALID_STATE'; throw e; }
    // Re-check the offer itself under the same lock: another request could
    // have accepted/withdrawn it while this one waited for the job lock.
    const { rows: offerRows } = await client.query(`SELECT * FROM offers WHERE id=$1 FOR UPDATE`, [offer.id]);
    const current = offerRows[0] ? offerFromRow(offerRows[0]) : null;
    if (!current || current.status !== 'PENDING') { const e = new Error('INVALID_STATE'); e.code='INVALID_STATE'; throw e; }
    // PERF: the offer's post-update row used to come from a third SELECT
    // (findOfferById) after the UPDATE below discarded its own result.
    // RETURNING * on the UPDATE gives the identical row for free, in the
    // same round trip, and is strictly more correct: it's guaranteed
    // atomic with the write instead of a separate read issued after it.
    const { rows: acceptedRows } = await client.query(`UPDATE offers SET status='ACCEPTED',updated_at=NOW() WHERE id=$1 RETURNING *`, [offer.id]);
    await client.query(`UPDATE offers SET status='REJECTED',updated_at=NOW() WHERE job_id=$1 AND id<>$2 AND status='PENDING'`, [job.id,offer.id]);
    const {rows}=await client.query(`UPDATE jobs SET provider_id=$2,status='ASSIGNED',updated_at=NOW() WHERE id=$1 RETURNING *`, [job.id,offer.providerId]);
    return { offer: offerFromRow(acceptedRows[0]), job: jobFromRow(rows[0]) };
  });
}
