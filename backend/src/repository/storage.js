import crypto from 'node:crypto';
import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { jobFromRow } from './mappers.js';
export async function insertUpload(upload) { const {rows}=await requirePool().query(`INSERT INTO uploads(id,storage_key,uploaded_by,content_type,size,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[upload.id,upload.storageKey,upload.uploadedBy,upload.contentType,upload.size,upload.createdAt]); const r=rows[0]; return {id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at}; }
export async function findUploadByKey(key, client=requirePool()) {
  const {rows}=await client.query(`SELECT * FROM uploads WHERE storage_key=$1`,[key]); const r=rows[0]; return r?{id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at}:null;
}
export async function listDeletableUserUploadKeys(userId) {
  const { rows } = await requirePool().query(
    `SELECT u.storage_key
       FROM uploads u
      WHERE u.uploaded_by=$1
        AND NOT EXISTS (
          SELECT 1 FROM evidence e WHERE e.uri=('storage://' || u.storage_key)
        )`,
    [userId],
  );
  return rows.map((row) => row.storage_key);
}
export async function createUploadIntent(intent) {
  const {rows}=await requirePool().query(`INSERT INTO upload_intents(id,storage_key,uploaded_by,content_type,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[intent.id,intent.storageKey,intent.uploadedBy,intent.contentType,intent.expiresAt,intent.createdAt]); const r=rows[0]; return {id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
}
export async function findUploadIntentForUpdate(key,client= requirePool()) {
  const {rows}=await client.query(`SELECT * FROM upload_intents WHERE storage_key=$1 FOR UPDATE`,[key]); const r=rows[0]; return r?{id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at}:null;
}
export async function completeUploadAtomic({intentId,key,userId,contentType,size,createdAt}) {
  return withSqlTransaction(async(client)=>{
    const {rows:ir}=await client.query(`SELECT * FROM upload_intents WHERE id=$1 AND storage_key=$2 FOR UPDATE`,[intentId,key]); const i=ir[0];
    if(!i || i.uploaded_by!==userId || i.content_type!==contentType || new Date(i.expires_at).getTime()<=Date.now()){const e=new Error('INVALID_UPLOAD_INTENT');e.code='INVALID_UPLOAD_INTENT';throw e;}
    const {rows:existing}=await client.query(`SELECT * FROM uploads WHERE storage_key=$1`,[key]); if(existing[0]){await client.query(`DELETE FROM upload_intents WHERE id=$1`,[intentId]); return {existing:true,upload:{id:existing[0].id,storageKey:existing[0].storage_key,uploadedBy:existing[0].uploaded_by,contentType:existing[0].content_type,size:existing[0].size,createdAt:existing[0].created_at?.toISOString?.() ?? existing[0].created_at}};}
    const {rows}=await client.query(`INSERT INTO uploads(id,storage_key,uploaded_by,content_type,size,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[crypto.randomUUID(),key,userId,contentType,size,createdAt]);
    await client.query(`DELETE FROM upload_intents WHERE id=$1`,[intentId]); const r=rows[0]; return {existing:false,upload:{id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at}};
  });
}
export async function insertAudit(audit) {
  await requirePool().query(`INSERT INTO audit_logs(id,action,actor_id,entity_type,entity_id,meta,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,[audit.id,audit.action,audit.actorId,audit.entityType,audit.entityId,audit.meta||{},audit.createdAt]);
}
export async function insertEvidence(evidence) {
  const {rows}=await requirePool().query(`INSERT INTO evidence(id,job_id,submitted_by,uri,notes,type,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[evidence.id,evidence.jobId,evidence.submittedBy,evidence.uri,evidence.notes,evidence.type,evidence.createdAt]);
  const r=rows[0]; return {id:r.id,jobId:r.job_id,submittedBy:r.submitted_by,uri:r.uri,notes:r.notes,type:r.type,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
}
export async function insertEvidenceAndTouchJob(evidence) {
  return withSqlTransaction(async (client) => {
    const { rows: jr } = await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`, [evidence.jobId]);
    if (!jr[0]) return null;
    const job = jobFromRow(jr[0]);
    if (job.providerId !== evidence.submittedBy || !['IN_PROGRESS'].includes(job.status)) {
      const e = new Error('INVALID_STATE'); e.code = 'INVALID_STATE'; throw e;
    }
    if (evidence.storageKey) {
      const { rows: ur } = await client.query(`SELECT id FROM uploads WHERE storage_key=$1 AND uploaded_by=$2`, [evidence.storageKey, evidence.submittedBy]);
      if (!ur[0]) { const e = new Error('INVALID_STORAGE_REFERENCE'); e.code = 'INVALID_STORAGE_REFERENCE'; throw e; }
    }
    const { rows } = await client.query(`INSERT INTO evidence(id,job_id,submitted_by,uri,notes,type,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [evidence.id,evidence.jobId,evidence.submittedBy,evidence.uri,evidence.notes,evidence.type,evidence.createdAt]);
    await client.query(`UPDATE jobs SET updated_at=$2 WHERE id=$1`, [evidence.jobId,evidence.createdAt]);
    const r = rows[0];
    return {id:r.id,jobId:r.job_id,submittedBy:r.submitted_by,uri:r.uri,notes:r.notes,type:r.type,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
  });
}
