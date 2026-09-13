const iso = (value) => value?.toISOString?.() ?? value;

export const userFromRow = (r) => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  displayName: r.displayName,
  role: r.role,
  status: r.status,
  sessionVersion: Number(r.session_version || 0),
  createdAt: iso(r.createdAt),
});

export const jobFromRow = (r) => ({
  id: r.id,
  ownerId: r.owner_id,
  providerId: r.provider_id,
  title: r.title,
  description: r.description,
  categoryId: r.category_id,
  jobType: r.job_type,
  budgetType: r.budget_type,
  budgetMin: Number(r.budget_min),
  budgetMax: Number(r.budget_max),
  duration: r.duration,
  acceptanceCriteria: r.acceptance_criteria,
  status: r.status,
  city: r.city,
  kind: r.kind || (r.job_type === 'FIXED' ? 'MISSION' : 'JOB'),
  visibility: r.visibility || 'PUBLIC',
  schedule: r.schedule || null,
  monthlySalary: r.monthly_salary == null ? null : Number(r.monthly_salary),
  applicationDeadline: r.application_deadline ? iso(r.application_deadline) : null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  publishedAt: r.published_at ? iso(r.published_at) : null,
  verticalId: r.vertical_id ?? null,
  attributes: r.attributes ?? {},
});

export const offerFromRow = (r) => ({
  id: r.id,
  jobId: r.job_id,
  providerId: r.provider_id,
  price: Number(r.price),
  message: r.message,
  status: r.status,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export const paymentFromRow = (r) => ({
  id: r.id,
  jobId: r.job_id,
  payerId: r.payer_id,
  payeeId: r.payee_id,
  amount: Number(r.amount),
  status: r.status,
  providerRef: r.provider_ref,
  idempotencyKey: r.idempotency_key || '',
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export const applicationFromRow = (r) => ({
  id: r.id,
  jobId: r.job_id,
  candidateId: r.candidate_id,
  resumeText: r.resume_text || '',
  skills: r.skills || '',
  status: r.status,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export const employerCandidateFromRow = (r) => ({
  id: r.id,
  resumeText: r.resume_text || '',
  skills: r.skills || '',
  status: r.status,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export const verticalFromRow = (r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  nameEn: r.name_en || '',
  description: r.description || '',
  config: r.config ?? {},
  isActive: r.is_active !== false,
  sortOrder: Number(r.sort_order || 0),
});
