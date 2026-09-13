import { requirePool } from './context.js';

export async function insertTrustReport(report) {
  const {rows}=await requirePool().query(`INSERT INTO trust_reports(id,reporter_id,entity_type,entity_id,reason,details,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[report.id,report.reporterId,report.entityType,report.entityId,report.reason,report.details||'',report.status||'OPEN',report.createdAt,report.updatedAt]);
  const r=rows[0]; return {id:r.id,reporterId:r.reporter_id,entityType:r.entity_type,entityId:r.entity_id,reason:r.reason,details:r.details||'',status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at};
}
export async function listTrustReports(status=null) {
  const params=[]; const where=status?(params.push(status),'WHERE r.status=$1'):'';
  const {rows}=await requirePool().query(`SELECT r.*,u.display_name AS reporter_name FROM trust_reports r LEFT JOIN users u ON u.id=r.reporter_id ${where} ORDER BY r.created_at DESC LIMIT 500`,params);
  return rows.map(r=>({id:r.id,reporterId:r.reporter_id,reporterName:r.reporter_name||null,entityType:r.entity_type,entityId:r.entity_id,reason:r.reason,details:r.details||'',status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at}));
}
export async function updateTrustReportStatus(id,status) {
  const {rows}=await requirePool().query(`UPDATE trust_reports SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,[id,status]);
  const r=rows[0]; return r?{id:r.id,reporterId:r.reporter_id,entityType:r.entity_type,entityId:r.entity_id,reason:r.reason,details:r.details||'',status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at}:null;
}
export async function listCandidatesForComparison(jobId, applicationIds) {
  const ids=Array.isArray(applicationIds)?applicationIds.slice(0,10):[]; if(!ids.length) return [];
  const {rows}=await requirePool().query(`SELECT a.id,a.resume_text,a.skills,a.status,u.display_name,u.id AS user_id FROM job_applications a JOIN users u ON u.id=a.candidate_id WHERE a.job_id=$1 AND a.id = ANY($2::uuid[]) AND a.status IN ('FORWARDED','INTERVIEW','OFFERED','ACCEPTED')`,[jobId,ids]);
  return rows.map(r=>({id:r.id,candidateId:r.user_id,resumeText:r.resume_text||'',skills:r.skills||'',status:r.status,displayName:r.display_name||'Candidate'}));
}

/**
 * Public, non-sensitive trust signals for a profile. This deliberately avoids
 * exposing raw reports or internal moderation state. Signals are descriptive,
 * not a hidden ranking penalty.
 */
export async function getPublicTrustSignals(userId) {
  const { rows } = await requirePool().query(`
    SELECT
      u.created_at,
      COALESCE(p.verification_status, 'UNVERIFIED') AS verification_status,
      COUNT(DISTINCT CASE WHEN j.provider_id = u.id AND j.status = 'COMPLETED' THEN j.id END) AS completed_jobs,
      COUNT(DISTINCT CASE WHEN j.provider_id = u.id AND j.status = 'IN_PROGRESS' THEN j.id END) AS active_jobs
    FROM users u
    LEFT JOIN providers p ON p.user_id = u.id
    LEFT JOIN jobs j ON j.provider_id = u.id
    WHERE u.id = $1
    GROUP BY u.id, u.created_at, p.verification_status
  `, [userId]);
  const r = rows[0];
  if (!r) return null;
  const verificationStatus = String(r.verification_status || 'UNVERIFIED').toUpperCase();
  return {
    verificationStatus,
    verified: verificationStatus === 'VERIFIED',
    completedJobs: Number(r.completed_jobs || 0),
    activeJobs: Number(r.active_jobs || 0),
    memberSince: r.created_at?.toISOString?.() ?? r.created_at ?? null,
  };
}

