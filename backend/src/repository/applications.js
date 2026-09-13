import { withSqlTransaction } from '../db.js';
import { requirePool } from './context.js';
import { applicationFromRow, employerCandidateFromRow } from './mappers.js';

export async function listAdminApplications() { const {rows}=await requirePool().query(`SELECT a.*, j.title AS job_title, u.display_name AS candidate_name FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.candidate_id ORDER BY a.created_at DESC`); return rows.map(r=>({...applicationFromRow(r),jobTitle:r.job_title,candidateName:r.candidate_name})); }
export async function transitionJobApplication(id, fromStatuses, toStatus) {
  const statuses = Array.isArray(fromStatuses) ? fromStatuses : [fromStatuses];
  const {rows}=await requirePool().query(`UPDATE job_applications SET status=$2,updated_at=NOW() WHERE id=$1 AND status = ANY($3::text[]) RETURNING *`,[id,toStatus,statuses]);
  return rows[0]?applicationFromRow(rows[0]):null;
}
export async function selectJobApplication(id) { return transitionJobApplication(id,['PENDING','SHORTLISTED'],'FORWARDED'); }
export async function listForwardedCandidatesForJob(jobId) { const {rows}=await requirePool().query(`SELECT id,resume_text,skills,status,created_at,updated_at FROM job_applications WHERE job_id=$1 AND status IN ('FORWARDED','INTERVIEW','OFFERED','ACCEPTED') ORDER BY updated_at DESC`,[jobId]); return rows.map(employerCandidateFromRow); }
// Backward-compatible repository contract name retained for older integrations/tests.
export async function listSelectedCandidatesForJob(jobId) { return listForwardedCandidatesForJob(jobId); }
export async function getJobApplicationById(id) { const {rows}=await requirePool().query(`SELECT * FROM job_applications WHERE id=$1`,[id]); return rows[0]?applicationFromRow(rows[0]):null; }
export async function getJobApplicationForCandidate(id,candidateId) { const {rows}=await requirePool().query(`SELECT * FROM job_applications WHERE id=$1 AND candidate_id=$2`,[id,candidateId]); return rows[0]?applicationFromRow(rows[0]):null; }
export async function listCandidateApplications(candidateId) { const {rows}=await requirePool().query(`SELECT a.*, j.title AS job_title, j.city AS job_city, j.kind AS job_kind, j.category_id, j.monthly_salary FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=$1 ORDER BY a.updated_at DESC`,[candidateId]); return rows.map(r=>({...applicationFromRow(r),jobTitle:r.job_title,jobCity:r.job_city,jobKind:r.job_kind,categoryId:r.category_id,monthlySalary:r.monthly_salary})); }
export async function transitionCandidateApplication(id, candidateId, fromStatuses, toStatus) { const statuses=Array.isArray(fromStatuses)?fromStatuses:[fromStatuses]; const {rows}=await requirePool().query(`UPDATE job_applications SET status=$3,updated_at=NOW() WHERE id=$1 AND candidate_id=$2 AND status = ANY($4::text[]) RETURNING *`,[id,candidateId,toStatus,statuses]); return rows[0]?applicationFromRow(rows[0]):null; }
export async function transitionEmployerApplication(id, ownerId, fromStatuses, toStatus, expectedJobId = null) {
  const statuses = Array.isArray(fromStatuses) ? fromStatuses : [fromStatuses];
  return withSqlTransaction(async(client)=>{
    // Serialize every employer-side lifecycle mutation on the job aggregate
    // first. Locking only the application row allowed two different
    // applications for the same job to both reach ACCEPTED and subsequently
    // overwrite jobs.provider_id in turn. The canonical lock order is now
    // job -> application, matching offer acceptance/funding mutations.
    const {rows:jobRows}=await client.query(`SELECT id,owner_id,kind,status FROM jobs WHERE id=(SELECT job_id FROM job_applications WHERE id=$1) FOR UPDATE`,[id]);
    const job=jobRows[0]; if(!job) return null;
    if(expectedJobId && job.id!==expectedJobId){const e=new Error('APPLICATION_JOB_MISMATCH');e.code='APPLICATION_JOB_MISMATCH';throw e;}
    if(job.owner_id!==ownerId){const e=new Error('FORBIDDEN');e.code='FORBIDDEN';throw e;}
    if(job.kind!=='JOB'){const e=new Error('JOB_ONLY');e.code='JOB_ONLY';throw e;}
    const {rows}=await client.query(`SELECT * FROM job_applications WHERE id=$1 FOR UPDATE`,[id]);
    const a=rows[0]; if(!a) return null;
    if(!statuses.includes(a.status)){const e=new Error('INVALID_APPLICATION_STATE');e.code='INVALID_APPLICATION_STATE';throw e;}
    if(toStatus==='ACCEPTED') {
      const {rows:accepted}=await client.query(`SELECT id FROM job_applications WHERE job_id=$1 AND status='ACCEPTED' FOR UPDATE`,[a.job_id]);
      if(accepted[0] && accepted[0].id!==a.id){const e=new Error('CANDIDATE_ALREADY_HIRED');e.code='CANDIDATE_ALREADY_HIRED';throw e;}
    }
    const {rows:updated}=await client.query(`UPDATE job_applications SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,[id,toStatus]);
    if (!updated[0]) return null;
    if (toStatus === 'ACCEPTED') {
      const accepted = updated[0];
      const { rows: jobRows } = await client.query(
        `UPDATE jobs
            SET provider_id=$2,status='ASSIGNED',updated_at=NOW()
          WHERE id=$1 AND owner_id=$3 AND kind='JOB' AND status IN ('PUBLISHED','ASSIGNED')
          RETURNING *`,
        [accepted.job_id, accepted.candidate_id, ownerId],
      );
      if (!jobRows[0]) {
        const e=new Error('JOB_NOT_HIRABLE'); e.code='JOB_NOT_HIRABLE'; throw e;
      }
    }
    return applicationFromRow(updated[0]);
  });
}

