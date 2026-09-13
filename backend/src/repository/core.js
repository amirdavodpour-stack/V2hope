import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { userFromRow, jobFromRow, offerFromRow, applicationFromRow, verticalFromRow } from './mappers.js';

const userSelect = `id,email,password_hash,password_hash AS "passwordHash",display_name AS "displayName",role,status,session_version,created_at AS "createdAt"`;
export async function findUserByEmail(email) {
  const { rows } = await requirePool().query(`SELECT ${userSelect} FROM users WHERE email=$1`, [email]);
  return rows[0] ? userFromRow(rows[0]) : null;
}
export async function findUserById(id) {
  const { rows } = await requirePool().query(`SELECT ${userSelect} FROM users WHERE id=$1`, [id]);
  return rows[0] ? userFromRow(rows[0]) : null;
}
export async function createUserWithProvider(user, provider) {
  return withSqlTransaction(async (client) => {
    await client.query(`INSERT INTO users(id,email,password_hash,display_name,role,status,session_version,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [user.id,user.email,user.passwordHash,user.displayName,user.role,user.status,user.sessionVersion || 0,user.createdAt]);
    await client.query(`INSERT INTO providers(id,user_id,provider_type,capacity,verification_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, [provider.id,provider.userId,provider.providerType,provider.capacity,provider.verificationStatus,provider.createdAt,provider.updatedAt]);
    return user;
  });
}
export async function listVerticals() {
  const { rows } = await requirePool().query(`SELECT id,slug,name,name_en,description,config,is_active,sort_order FROM verticals WHERE is_active=TRUE ORDER BY sort_order,slug`);
  return rows.map(verticalFromRow);
}
export async function listCategories(verticalSlug = null) {
  const base = `SELECT id,slug,name,name_en,description,parent_id,sort_order,is_active,created_at AS \"createdAt\" FROM categories WHERE is_active=TRUE`;
  const params = [];
  let where = '';
  if (verticalSlug) { params.push(String(verticalSlug)); where = ` AND vertical_id=(SELECT id FROM verticals WHERE slug=$1)`; }
  const { rows } = await requirePool().query(`${base}${where} ORDER BY sort_order,name`, params);
  return rows.map((r)=>({id:r.id,slug:r.slug,name:r.name,nameEn:r.name_en||'',description:r.description||'',parentId:r.parent_id||null,sortOrder:Number(r.sort_order||0),isActive:r.is_active!==false,createdAt:r.createdAt?.toISOString?.() ?? r.createdAt}));
}
export async function findJobById(id, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM jobs WHERE id=$1`, [id]);
  return rows[0] ? jobFromRow(rows[0]) : null;
}
export async function listJobs(status, userId = null) {
  const params = [status];
  let where = `status=$1`;
  if (userId) { params.push(userId); where += ` AND (owner_id=$2 OR provider_id=$2)`; }
  const { rows } = await requirePool().query(`SELECT * FROM jobs WHERE ${where} ORDER BY updated_at DESC`, params);
  return rows.map(jobFromRow);
}
export async function insertJob(job) {
  const { rows } = await requirePool().query(`INSERT INTO jobs(id,owner_id,provider_id,title,description,category_id,job_type,budget_type,budget_min,budget_max,duration,acceptance_criteria,status,city,kind,visibility,schedule,monthly_salary,application_deadline,created_at,updated_at,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`, [job.id,job.ownerId,job.providerId,job.title,job.description,job.categoryId,job.jobType,job.budgetType,job.budgetMin,job.budgetMax,job.duration,job.acceptanceCriteria,job.status,job.city,job.kind || (job.jobType==='FIXED'?'MISSION':'JOB'),job.visibility || 'PUBLIC',job.schedule || null,job.monthlySalary ?? null,job.applicationDeadline || null,job.createdAt,job.updatedAt,job.publishedAt]);
  return jobFromRow(rows[0]);
}
export async function updateJobWithLock(id, expectedStatuses, patcher) {
  return withSqlTransaction(async (client) => {
    const job = await findJobById(id, client);
    if (!job) return null;
    if (!expectedStatuses.includes(job.status)) { const e = new Error('INVALID_STATE'); e.code='INVALID_STATE'; throw e; }
    const updated = await patcher(job, client);
    const fields = Object.keys(updated).filter((k)=>['providerId','status','updatedAt','publishedAt'].includes(k));
    const mapping = {providerId:'provider_id',status:'status',updatedAt:'updated_at',publishedAt:'published_at'};
    const sets = fields.map((k,i)=>`${mapping[k]}=$${i+2}`);
    if (sets.length) {
      const values=[id,...fields.map((k)=>updated[k])];
      const {rows}=await client.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 RETURNING *`, values);
      return jobFromRow(rows[0]);
    }
    return job;
  });
}
export async function findOffers(jobId, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM offers WHERE job_id=$1 ORDER BY created_at ASC`, [jobId]);
  return rows.map(offerFromRow);
}
// view_helpers.js and payment_routes.js call this name; keep it as the
// canonical alias for findOffers so the PostgreSQL repository path provides
// the same surface as the contract used by those callers.
export const listOffersForJob = findOffers;
export async function findOfferById(id, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM offers WHERE id=$1`, [id]);
  return rows[0] ? offerFromRow(rows[0]) : null;
}

export async function insertJobApplication(a) {
  try {
    const {rows}=await requirePool().query(`INSERT INTO job_applications(id,job_id,candidate_id,resume_text,skills,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[a.id,a.jobId,a.candidateId,a.resumeText,a.skills||'',a.status||'PENDING',a.createdAt,a.updatedAt]);
    return applicationFromRow(rows[0]);
  } catch (error) {
    if (error?.code === '23505' && error?.constraint === 'job_applications_pending_uq') {
      const e=new Error('APPLICATION_EXISTS'); e.code='APPLICATION_EXISTS'; throw e;
    }
    throw error;
  }
}
export async function findJobApplication(jobId,candidateId) { const {rows}=await requirePool().query(`SELECT * FROM job_applications WHERE job_id=$1 AND candidate_id=$2 AND status IN ('PENDING','SELECTED') LIMIT 1`,[jobId,candidateId]); return rows[0]?applicationFromRow(rows[0]):null; }



export async function insertOffer(offer) {
  try {
    const { rows } = await requirePool().query(`INSERT INTO offers(id,job_id,provider_id,price,message,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [offer.id,offer.jobId,offer.providerId,offer.price,offer.message,offer.status,offer.createdAt,offer.updatedAt]);
    return offerFromRow(rows[0]);
  } catch (error) {
    if (error?.code === '23505' && error?.constraint === 'offers_pending_provider_uq') {
      const e=new Error('OFFER_EXISTS'); e.code='OFFER_EXISTS'; throw e;
    }
    throw error;
  }
}
export async function findPendingOffer(jobId, providerId, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM offers WHERE job_id=$1 AND provider_id=$2 AND status='PENDING' LIMIT 1`, [jobId, providerId]);
  return rows[0] ? offerFromRow(rows[0]) : null;
}
