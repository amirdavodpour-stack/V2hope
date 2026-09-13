import crypto from 'node:crypto';
import { config } from '../config.js';

export const tableColumns = {
  users: ['email','password_hash','display_name','role','status','session_version','created_at'],
  providers: ['user_id','provider_type','capacity','verification_status','created_at','updated_at'],
  refresh_tokens: ['user_id','token_hash','family_id','expires_at','created_at','revoked_at','replaced_by'],
  reset_tokens: ['user_id','token_hash','family_id','expires_at','used_at','created_at'],
  categories: ['slug','name','name_en','description','parent_id','sort_order','is_active','created_at'],
  jobs: ['owner_id','provider_id','title','description','category_id','job_type','budget_type','budget_min','budget_max','duration','acceptance_criteria','status','city','kind','visibility','schedule','monthly_salary','application_deadline','created_at','updated_at','published_at'],
  offers: ['job_id','provider_id','price','message','status','created_at','updated_at'],
  job_applications: ['job_id','candidate_id','resume_text','skills','status','created_at','updated_at'],
  payments: ['job_id','payer_id','payee_id','amount','status','provider_ref','idempotency_key','base_amount','employer_fee','worker_fee','platform_fee','employer_charge','provider_payout','fee_policy_version','currency','created_at','updated_at'],
  ledger_entries: ['journal_id','reference_type','reference_id','account','debit','credit','currency','created_at'],
  settlements: ['payment_id','provider_ref','amount','currency','status','created_at','updated_at'],
  refunds: ['payment_id','amount','status','provider_ref','idempotency_key','created_at','updated_at'],
  payment_webhook_events: ['event_id','event_type','payment_id','provider_ref','payload','processed_at','created_at'],
  evidence: ['job_id','submitted_by','uri','notes','type','created_at'],
  uploads: ['storage_key','uploaded_by','content_type','size','created_at'],
  upload_intents: ['storage_key','uploaded_by','content_type','expires_at','created_at'],
  audit_logs: ['action','actor_id','entity_type','entity_id','meta','created_at'],
  notifications: ['user_id','type','title','body','data','read_at','created_at'],
  notification_preferences: ['user_id','in_app','push','email','job_alerts','application_updates','payment_updates','marketing','updated_at'],
  notification_devices: ['user_id','platform','token','enabled','created_at','updated_at'],
  analytics_events: ['event_name','user_id','anonymous_id','session_id','app_version','platform','properties','dedupe_key','occurred_at','created_at'],
  crash_reports: ['user_id','anonymous_id','app_version','platform','release_channel','fingerprint','message','stack','context','occurred_at','created_at'],
  trust_reports: ['reporter_id','entity_type','entity_id','reason','details','status','created_at','updated_at'],
  saved_searches: ['user_id','name','query','kind','visibility','city','category','updated_at','created_at'],
};

export function toDbRow(collection, row) {
  switch (collection) {
    case 'users': return [row.id,row.email,row.passwordHash,row.displayName,row.role,row.status,row.sessionVersion || 0,row.createdAt];
    case 'providers': return [row.id,row.userId,row.providerType,row.capacity,row.verificationStatus,row.createdAt,row.updatedAt];
    case 'refreshTokens': return [row.id,row.userId,row.tokenHash,row.familyId,row.expiresAt,row.createdAt,row.revokedAt,row.replacedBy];
    case 'resetTokens': return [row.id,row.userId,row.tokenHash,row.familyId || crypto.randomUUID(),row.expiresAt,row.usedAt,row.createdAt];
    case 'categories': return [row.id,row.slug,row.name,row.nameEn || '',row.description || '',row.parentId || null,Number(row.sortOrder || 0),row.isActive !== false,row.createdAt];
    case 'jobs': return [row.id,row.ownerId,row.providerId,row.title,row.description,row.categoryId,row.jobType,row.budgetType,row.budgetMin,row.budgetMax,row.duration,row.acceptanceCriteria,row.status,row.city,row.kind || (row.jobType==='FIXED'?'MISSION':'JOB'),row.visibility || 'PUBLIC',row.schedule || null,row.monthlySalary ?? null,row.applicationDeadline || null,row.createdAt,row.updatedAt,row.publishedAt];
    case 'offers': return [row.id,row.jobId,row.providerId,row.price,row.message,row.status,row.createdAt,row.updatedAt];
    case 'jobApplications': return [row.id,row.jobId,row.candidateId,row.resumeText || '',row.skills || '',row.status,row.createdAt,row.updatedAt];
    case 'payments': return [row.id,row.jobId,row.payerId,row.payeeId,row.amount,row.status,row.providerRef,row.idempotencyKey,row.baseAmount ?? row.amount,row.employerFee ?? 0,row.workerFee ?? 0,row.platformFee ?? 0,row.employerCharge ?? row.amount,row.providerPayout ?? row.amount,row.feePolicyVersion || 'legacy',row.currency || config.paymentCurrency,row.createdAt,row.updatedAt];
    case 'ledgerEntries': return [row.id,row.journalId,row.referenceType,row.referenceId,row.account,Number(row.debit||0),Number(row.credit||0),row.currency || config.paymentCurrency,row.createdAt];
    case 'settlements': return [row.id,row.paymentId,row.providerRef,row.amount,row.currency || config.paymentCurrency,row.status,row.createdAt,row.updatedAt];
    case 'refunds': return [row.id,row.paymentId,row.amount,row.status,row.providerRef || null,row.idempotencyKey || null,row.createdAt,row.updatedAt];
    case 'paymentWebhooks': return [row.id,row.eventId,row.eventType,row.paymentId,row.providerRef || null,row.payload || {},row.processedAt || null,row.createdAt];
    case 'evidence': return [row.id,row.jobId,row.submittedBy,row.uri,row.notes,row.type,row.createdAt];
    case 'uploads': return [row.id,row.storageKey,row.uploadedBy,row.contentType,row.size,row.createdAt];
    case 'uploadIntents': return [row.id,row.storageKey,row.uploadedBy,row.contentType,row.expiresAt,row.createdAt];
    case 'audit': return [row.id,row.action,row.actorId||null,row.entityType,row.entityId||null,row.meta||{},row.createdAt];
    case 'notifications': return [row.id,row.userId,row.type,row.title,row.body,row.data||{},row.readAt||null,row.createdAt];
    case 'notificationPreferences': return [row.id,row.userId,row.inApp,row.push,row.email,row.jobAlerts,row.applicationUpdates,row.paymentUpdates,row.marketing,row.updatedAt];
    case 'notificationDevices': return [row.id,row.userId,row.platform,row.token,row.enabled,row.createdAt,row.updatedAt];
    case 'analyticsEvents': return [row.id,row.eventName,row.userId||null,row.anonymousId||null,row.sessionId||null,row.appVersion||null,row.platform||null,row.properties||{},row.dedupeKey||null,row.occurredAt,row.createdAt];
    case 'crashReports': return [row.id,row.userId||null,row.anonymousId||null,row.appVersion||null,row.platform||null,row.releaseChannel||null,row.fingerprint,row.message,row.stack||null,row.context||{},row.occurredAt,row.createdAt];
    case 'trustReports': return [row.id,row.reporterId,row.entityType,row.entityId,row.reason,row.details||'',row.status,row.createdAt,row.updatedAt];
    case 'savedSearches': return [row.id,row.userId,row.name,row.query||'',row.kind||'ALL',row.visibility||'ALL',row.city||'AUTO',row.category||'ALL',row.updatedAt,row.createdAt];
    default: throw new Error(`Unknown collection ${collection}`);
  }
}

export function fromDbRow(collection, r) {
  switch (collection) {
    case 'users': return { id:r.id,email:r.email,passwordHash:r.password_hash,displayName:r.display_name,role:r.role,status:r.status,sessionVersion:Number(r.session_version || 0),createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'providers': return { id:r.id,userId:r.user_id,providerType:r.provider_type,capacity:r.capacity,verificationStatus:r.verification_status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'refreshTokens': return { id:r.id,userId:r.user_id,tokenHash:r.token_hash,familyId:r.family_id,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at,revokedAt:r.revoked_at ? (r.revoked_at.toISOString?.() ?? r.revoked_at) : null,replacedBy:r.replaced_by };
    case 'resetTokens': return { id:r.id,userId:r.user_id,tokenHash:r.token_hash,familyId:r.family_id,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,usedAt:r.used_at ? (r.used_at.toISOString?.() ?? r.used_at) : null,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'categories': return { id:r.id,slug:r.slug,name:r.name,nameEn:r.name_en || '',description:r.description || '',parentId:r.parent_id || null,sortOrder:Number(r.sort_order || 0),isActive:r.is_active !== false,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'jobs': return { id:r.id,ownerId:r.owner_id,providerId:r.provider_id,title:r.title,description:r.description,categoryId:r.category_id,jobType:r.job_type,budgetType:r.budget_type,budgetMin:Number(r.budget_min),budgetMax:Number(r.budget_max),duration:r.duration,acceptanceCriteria:r.acceptance_criteria,status:r.status,city:r.city,kind:r.kind || (r.job_type==='FIXED'?'MISSION':'JOB'),visibility:r.visibility || 'PUBLIC',schedule:r.schedule || null,monthlySalary:r.monthly_salary==null?null:Number(r.monthly_salary),applicationDeadline:r.application_deadline ? (r.application_deadline.toISOString?.() ?? r.application_deadline) : null,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at,publishedAt:r.published_at ? (r.published_at.toISOString?.() ?? r.published_at) : null };
    case 'offers': return { id:r.id,jobId:r.job_id,providerId:r.provider_id,price:Number(r.price),message:r.message,status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'jobApplications': return { id:r.id,jobId:r.job_id,candidateId:r.candidate_id,resumeText:r.resume_text || '',skills:r.skills || '',status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'payments': return { id:r.id,jobId:r.job_id,payerId:r.payer_id,payeeId:r.payee_id,amount:Number(r.amount),status:r.status,providerRef:r.provider_ref,idempotencyKey:r.idempotency_key || '',baseAmount:Number(r.base_amount ?? r.amount),employerFee:Number(r.employer_fee || 0),workerFee:Number(r.worker_fee || 0),platformFee:Number(r.platform_fee || 0),employerCharge:Number(r.employer_charge ?? r.amount),providerPayout:Number(r.provider_payout ?? r.amount),feePolicyVersion:r.fee_policy_version || 'legacy',currency:r.currency || config.paymentCurrency,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'ledgerEntries': return { id:r.id,journalId:r.journal_id,referenceType:r.reference_type,referenceId:r.reference_id,account:r.account,debit:Number(r.debit||0),credit:Number(r.credit||0),currency:r.currency || config.paymentCurrency,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'settlements': return { id:r.id,paymentId:r.payment_id,providerRef:r.provider_ref,amount:Number(r.amount),currency:r.currency || config.paymentCurrency,status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'refunds': return { id:r.id,paymentId:r.payment_id,amount:Number(r.amount),status:r.status,providerRef:r.provider_ref,idempotencyKey:r.idempotency_key || '',createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'paymentWebhooks': return { id:r.id,eventId:r.event_id,eventType:r.event_type,paymentId:r.payment_id,providerRef:r.provider_ref,payload:r.payload || {},processedAt:r.processed_at ? (r.processed_at.toISOString?.() ?? r.processed_at) : null,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'evidence': return { id:r.id,jobId:r.job_id,submittedBy:r.submitted_by,uri:r.uri,notes:r.notes,type:r.type,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'uploads': return { id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'uploadIntents': return { id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'audit': return {id:r.id,action:r.action,actorId:r.actor_id||null,entityType:r.entity_type,entityId:r.entity_id||null,meta:r.meta||{},createdAt:r.created_at?.toISOString?.() ?? r.created_at};
    case 'notifications': return {id:r.id,userId:r.user_id,type:r.type,title:r.title,body:r.body,data:r.data||{},readAt:r.read_at ? (r.read_at.toISOString?.() ?? r.read_at) : null,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
    case 'notificationPreferences': return {id:r.id,userId:r.user_id,inApp:r.in_app,push:r.push,email:r.email,jobAlerts:r.job_alerts,applicationUpdates:r.application_updates,paymentUpdates:r.payment_updates,marketing:r.marketing,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at};
    case 'notificationDevices': return {id:r.id,userId:r.user_id,platform:r.platform,token:r.token,enabled:r.enabled,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at};
    case 'analyticsEvents': return {id:r.id,eventName:r.event_name,userId:r.user_id||null,anonymousId:r.anonymous_id||null,sessionId:r.session_id||null,appVersion:r.app_version||null,platform:r.platform||null,properties:r.properties||{},dedupeKey:r.dedupe_key||null,occurredAt:r.occurred_at?.toISOString?.() ?? r.occurred_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
    case 'crashReports': return {id:r.id,userId:r.user_id||null,anonymousId:r.anonymous_id||null,appVersion:r.app_version||null,platform:r.platform||null,releaseChannel:r.release_channel||null,fingerprint:r.fingerprint,message:r.message,stack:r.stack||null,context:r.context||{},occurredAt:r.occurred_at?.toISOString?.() ?? r.occurred_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
    case 'trustReports': return {id:r.id,reporterId:r.reporter_id,entityType:r.entity_type,entityId:r.entity_id,reason:r.reason,details:r.details||'',status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at};
    case 'savedSearches': return {id:r.id,userId:r.user_id,name:r.name,query:r.query||'',kind:r.kind||'ALL',visibility:r.visibility||'ALL',city:r.city||'AUTO',category:r.category||'ALL',updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
    default: throw new Error(`Unknown collection ${collection}`);
  }
}

