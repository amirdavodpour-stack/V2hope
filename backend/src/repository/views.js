import { requirePool } from './context.js';
import { jobFromRow, paymentFromRow, offerFromRow } from './mappers.js';
export async function findCategoryByIdOrSlug(value) {
  const { rows } = await requirePool().query(`SELECT id,slug,name,created_at FROM categories WHERE id::text=$1 OR slug=$1 LIMIT 1`, [String(value)]);
  const r=rows[0]; return r ? { id:r.id, slug:r.slug, name:r.name, createdAt:r.created_at?.toISOString?.() ?? r.created_at } : null;
}

export async function listJobViews({ status, userId = null, kind = null, visibility = null, city = null, categoryId = null, search = null }) {
  const params=[status];
  let where=`j.status=$1`;
  if(userId){ params.push(userId); where += ` AND (j.owner_id=$${params.length} OR j.provider_id=$${params.length})`; }
  if(kind){ params.push(kind); where += ` AND j.kind=$${params.length}`; }
  if(visibility){ params.push(visibility); where += ` AND j.visibility=$${params.length}`; }
  if(city){ params.push(city); where += ` AND j.city=$${params.length}`; }
  if(categoryId){ params.push(categoryId); const i=params.length; where += ` AND (j.category_id::text=$${i} OR c.slug=$${i})`; }
  if(search){ params.push(`%${String(search).trim()}%`); const i=params.length; where += ` AND (j.title ILIKE $${i} OR j.description ILIKE $${i} OR j.city ILIKE $${i} OR c.name ILIKE $${i} OR c.name_en ILIKE $${i})`; }
  const { rows } = await requirePool().query(
    `SELECT j.*, c.name AS category_name,
            ou.display_name AS owner_display_name, ou.role AS owner_role,
            pu.display_name AS provider_display_name, pu.role AS provider_role,
            COUNT(o.id)::int AS offer_count
       FROM jobs j
       JOIN categories c ON c.id=j.category_id
       JOIN users ou ON ou.id=j.owner_id
       LEFT JOIN users pu ON pu.id=j.provider_id
       LEFT JOIN offers o ON o.job_id=j.id
      WHERE ${where}
      GROUP BY j.id,c.name,c.slug,ou.display_name,ou.role,pu.display_name,pu.role
      ORDER BY j.updated_at DESC`, params);
  return rows.map(r=>({
    job:jobFromRow(r),
    category:r.category_name,
    owner:r.owner_display_name ? {id:r.owner_id,displayName:r.owner_display_name,role:r.owner_role} : null,
    provider:r.provider_display_name ? {id:r.provider_id,displayName:r.provider_display_name,role:r.provider_role} : null,
    offerCount:Number(r.offer_count||0),
  }));
}

export async function listMyJobViews(userId) {
  const { rows } = await requirePool().query(
    `SELECT j.*, c.name AS category_name,
            ou.display_name AS owner_display_name, ou.role AS owner_role,
            pu.display_name AS provider_display_name, pu.role AS provider_role,
            COUNT(DISTINCT o.id)::int AS offer_count,
            p.id AS payment_id,p.status AS payment_status,p.amount AS payment_amount,p.provider_ref AS payment_provider_ref,
            p.created_at AS payment_created_at,p.updated_at AS payment_updated_at,p.idempotency_key AS payment_idempotency_key,
            p.base_amount AS payment_base_amount,p.employer_fee AS payment_employer_fee,p.worker_fee AS payment_worker_fee,
            p.platform_fee AS payment_platform_fee,p.employer_charge AS payment_employer_charge,p.provider_payout AS payment_provider_payout,
            p.fee_policy_version AS payment_fee_policy_version,p.currency AS payment_currency
       FROM jobs j
       JOIN categories c ON c.id=j.category_id
       JOIN users ou ON ou.id=j.owner_id
       LEFT JOIN users pu ON pu.id=j.provider_id
       LEFT JOIN offers o ON o.job_id=j.id
       LEFT JOIN payments p ON p.job_id=j.id
      WHERE j.owner_id=$1 OR j.provider_id=$1
      GROUP BY j.id,c.name,ou.display_name,ou.role,pu.display_name,pu.role,p.id
      ORDER BY j.updated_at DESC`, [userId]);
  return rows.map(r=>({
    job:jobFromRow(r), category:r.category_name,
    owner:r.owner_display_name?{id:r.owner_id,displayName:r.owner_display_name,role:r.owner_role}:null,
    provider:r.provider_display_name?{id:r.provider_id,displayName:r.provider_display_name,role:r.provider_role}:null,
    offerCount:Number(r.offer_count||0),
    payment:r.payment_id?paymentFromRow({id:r.payment_id,job_id:r.id,payer_id:null,payee_id:null,amount:r.payment_amount,status:r.payment_status,provider_ref:r.payment_provider_ref,idempotency_key:r.payment_idempotency_key,created_at:r.payment_created_at,updated_at:r.payment_updated_at}):null,
  }));
}

export async function listOfferViewsForJob(jobId) {
  const { rows } = await requirePool().query(
    `SELECT o.*, u.display_name AS provider_display_name, u.role AS provider_role
       FROM offers o JOIN users u ON u.id=o.provider_id
      WHERE o.job_id=$1 ORDER BY o.created_at ASC`, [jobId]);
  return rows.map(o=>({
    id:o.id,jobId:o.job_id,providerId:o.provider_id,price:Number(o.price),message:o.message,status:o.status,
    createdAt:o.created_at?.toISOString?.() ?? o.created_at,updatedAt:o.updated_at?.toISOString?.() ?? o.updated_at,
    provider:o.provider_display_name?{id:o.provider_id,displayName:o.provider_display_name,role:o.provider_role}:null,
  }));
}


export async function listLedgerEntriesForPayment(paymentId) {
  const { rows } = await requirePool().query(`SELECT * FROM ledger_entries WHERE reference_id=$1 ORDER BY created_at,id`, [paymentId]);
  return rows.map(r=>({id:r.id,journalId:r.journal_id,referenceType:r.reference_type,referenceId:r.reference_id,account:r.account,debit:Number(r.debit||0),credit:Number(r.credit||0),currency:r.currency,createdAt:r.created_at?.toISOString?.() ?? r.created_at}));
}
