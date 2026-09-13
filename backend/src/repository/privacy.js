import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { userFromRow, jobFromRow, offerFromRow, paymentFromRow, applicationFromRow } from './mappers.js';

const userSelect = `id,email,password_hash,password_hash AS "passwordHash",display_name AS "displayName",role,status,session_version,created_at AS "createdAt"`;

export async function getUserPrivacyBundle(userId) {
  const pool = requirePool();
  const [u,p,j,a,o,pay,n,prefs,ev,up,analytics,crashes,trust] = await Promise.all([
    pool.query(`SELECT ${userSelect} FROM users WHERE id=$1`, [userId]),
    pool.query(`SELECT id,user_id,provider_type,capacity,verification_status,created_at,updated_at FROM providers WHERE user_id=$1`, [userId]),
    pool.query(`SELECT * FROM jobs WHERE owner_id=$1 OR provider_id=$1 ORDER BY created_at DESC`, [userId]),
    pool.query(`SELECT * FROM job_applications WHERE candidate_id=$1 ORDER BY created_at DESC`, [userId]),
    pool.query(`SELECT o.* FROM offers o JOIN jobs j ON j.id=o.job_id WHERE o.provider_id=$1 OR j.owner_id=$1 ORDER BY o.created_at DESC`, [userId]),
    pool.query(`SELECT * FROM payments WHERE payer_id=$1 OR payee_id=$1 ORDER BY created_at DESC`, [userId]),
    pool.query(`SELECT id,type,title,body,created_at,read_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC`, [userId]),
    pool.query(`SELECT * FROM notification_preferences WHERE user_id=$1`, [userId]),
    pool.query(`SELECT * FROM evidence WHERE submitted_by=$1 ORDER BY created_at DESC`, [userId]),
    pool.query(`SELECT * FROM uploads WHERE uploaded_by=$1 ORDER BY created_at DESC`, [userId]),
    pool.query(`SELECT * FROM analytics_events WHERE user_id=$1 ORDER BY occurred_at DESC`, [userId]),
    pool.query(`SELECT * FROM crash_reports WHERE user_id=$1 ORDER BY occurred_at DESC`, [userId]),
    pool.query(`SELECT * FROM trust_reports WHERE reporter_id=$1 ORDER BY created_at DESC`, [userId]),
  ]);
  if (!u.rows[0]) return null;
  return { user:userFromRow(u.rows[0]), provider:p.rows[0] ? {id:p.rows[0].id,userId:p.rows[0].user_id,providerType:p.rows[0].provider_type,capacity:p.rows[0].capacity,verificationStatus:p.rows[0].verification_status,createdAt:p.rows[0].created_at?.toISOString?.()??p.rows[0].created_at,updatedAt:p.rows[0].updated_at?.toISOString?.()??p.rows[0].updated_at} : null,
    jobs:j.rows.map(jobFromRow), applications:a.rows.map(applicationFromRow), offers:o.rows.map(offerFromRow), payments:pay.rows.map(paymentFromRow),
    notifications:n.rows.map(r=>({id:r.id,type:r.type,title:r.title,body:r.body,createdAt:r.created_at?.toISOString?.()??r.created_at,readAt:r.read_at?.toISOString?.()??r.read_at})),
    preferences:prefs.rows[0]||null, evidence:ev.rows.map(r=>({id:r.id,jobId:r.job_id,submittedBy:r.submitted_by,uri:r.uri,notes:r.notes,type:r.type,createdAt:r.created_at?.toISOString?.()??r.created_at})), uploads:up.rows.map(r=>({id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.()??r.created_at})),
    analyticsEvents:analytics.rows.map(r=>({id:r.id,eventName:r.event_name,userId:r.user_id,anonymousId:r.anonymous_id,sessionId:r.session_id,appVersion:r.app_version,platform:r.platform,properties:r.properties||{},dedupeKey:r.dedupe_key,occurredAt:r.occurred_at?.toISOString?.()??r.occurred_at,createdAt:r.created_at?.toISOString?.()??r.created_at})),
    crashReports:crashes.rows.map(r=>({id:r.id,userId:r.user_id,anonymousId:r.anonymous_id,appVersion:r.app_version,platform:r.platform,releaseChannel:r.release_channel,fingerprint:r.fingerprint,message:r.message,stack:r.stack,context:r.context||{},occurredAt:r.occurred_at?.toISOString?.()??r.occurred_at,createdAt:r.created_at?.toISOString?.()??r.created_at})),
    trustReports:trust.rows.map(r=>({id:r.id,reporterId:r.reporter_id,entityType:r.entity_type,entityId:r.entity_id,reason:r.reason,details:r.details||'',status:r.status,createdAt:r.created_at?.toISOString?.()??r.created_at,updatedAt:r.updated_at?.toISOString?.()??r.updated_at})) };
}

export async function deleteUserPrivacyBundle(userId, replacement) {
  return withSqlTransaction(async(client)=>{
    const u = await client.query(`SELECT id,role FROM users WHERE id=$1 FOR UPDATE`, [userId]);
    if (!u.rows[0]) return false;
    const tables = ['refresh_tokens','reset_tokens','notification_devices','notification_preferences','notifications'];
    for (const t of tables) await client.query(`DELETE FROM ${t} WHERE user_id=$1`, [userId]);
    await client.query(`UPDATE analytics_events SET user_id=NULL WHERE user_id=$1`, [userId]);
    await client.query(`UPDATE crash_reports SET user_id=NULL WHERE user_id=$1`, [userId]);
    await client.query(`DELETE FROM upload_intents WHERE uploaded_by=$1`, [userId]);
    await client.query(`UPDATE evidence SET submitted_by=NULL WHERE submitted_by=$1`, [userId]);
    await client.query(`UPDATE uploads SET uploaded_by=NULL WHERE uploaded_by=$1`, [userId]);
    await client.query(`UPDATE jobs SET provider_id=NULL WHERE provider_id=$1 AND status IN ('DRAFT','PUBLISHED')`, [userId]);
    await client.query(`UPDATE users SET email=$2,password_hash=$3,display_name='Deleted user',status='DELETED',session_version=session_version+1 WHERE id=$1`, [userId,replacement.email,replacement.passwordHash]);
    await client.query(`UPDATE audit_logs SET actor_id=NULL WHERE actor_id=$1`, [userId]);
    await client.query(`DELETE FROM trust_reports WHERE reporter_id=$1`, [userId]);
    return true;
  });
}
