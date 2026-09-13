import crypto from 'node:crypto';
/**
 * View/composition helpers shared by HTTP route modules.
 * Kept dependency-injected so app.js remains a composition root rather than
 * owning data-shaping, cache, and audit concerns itself.
 */
export function createAppViewHelpers({ repo, config, getUserById, now, HttpError, env = process.env, categories = [], legacy = {}, id = crypto.randomUUID }) {
  async function getProvider(userId) {
    return env.DATABASE_URL ? repo.findProviderByUserId(userId) : (legacy.providers || []).find((p) => p.userId === userId);
  }

  const categoryBy = (id) => categories.find((c) => c.id === id || c.slug === id);
  const publicUser = (u) => (u ? { id: u.id, displayName: u.displayName, role: u.role } : null);
  const authUserView = (u) => ({ ...publicUser(u), email: u.email });

  async function categoryView(id) {
    if (env.DATABASE_URL) {
      const c = await repo.findCategoryByIdOrSlug(id);
      return c?.name || id || null;
    }
    return categoryBy(id)?.name || id || null;
  }

  function buildOfferCountMap() {
    const map = new Map();
    for (const offer of (legacy.offers || [])) map.set(offer.jobId, (map.get(offer.jobId) || 0) + 1);
    return map;
  }

  async function offerCountFor(jobId, offerCountByJob) {
    if (offerCountByJob) return offerCountByJob.get(jobId) || 0;
    if (env.DATABASE_URL) return (await repo.listOffersForJob(jobId)).length;
    return (legacy.offers || []).filter((o) => o.jobId === jobId).length;
  }

  async function jobView(job, viewerId, offerCountByJob, resolved) {
    const [owner, provider, offerCount, category] = await Promise.all([
      resolved && 'owner' in resolved ? resolved.owner : getUserById(job.ownerId),
      resolved && 'provider' in resolved ? resolved.provider : (job.providerId ? getUserById(job.providerId) : null),
      offerCountFor(job.id, offerCountByJob),
      resolved && 'category' in resolved ? resolved.category : categoryView(job.categoryId),
    ]);
    return {
      id: job.id, title: job.title, description: job.description, categoryId: job.categoryId,
      category, jobType: job.jobType, budgetType: job.budgetType,
      budgetMin: job.budgetMin, budgetMax: job.budgetMax, duration: job.duration,
      acceptanceCriteria: job.acceptanceCriteria, status: job.status, ownerId: job.ownerId,
      providerId: job.providerId, owner: publicUser(owner),
      provider: publicUser(provider), offerCount,
      city: job.city || null, kind: job.kind || (job.jobType === 'FIXED' ? 'MISSION' : 'JOB'), visibility: job.visibility || 'PUBLIC', schedule: job.schedule || null, monthlySalary: job.monthlySalary ?? null, applicationDeadline: job.applicationDeadline || null, feePolicy: (job.kind || (job.jobType === 'FIXED' ? 'MISSION' : 'JOB')) === 'MISSION' ? { employerRate: 0.10, candidateRate: 0.10, model: 'PER_MISSION' } : { employerRate: 0.30, candidateRate: 0, model: 'FIRST_MONTH_SALARY' }, createdAt: job.createdAt, updatedAt: job.updatedAt,
      isOwner: job.ownerId === viewerId,
      verticalId: job.verticalId ?? null,
      attributes: job.attributes ?? {},
    };
  }

  async function paymentView(payment, job, resolved) {
    if (!payment) return { status: 'NO_TRANSACTION', paymentStatus: 'UNFUNDED', amount: null, providerRef: null, job: await jobView(job, null, undefined, resolved) };
    return {
      id: payment.id, status: payment.status, paymentStatus: payment.status,
      amount: payment.amount, providerRef: payment.providerRef,
      fees: { baseAmount: payment.baseAmount ?? payment.amount, employerFee: payment.employerFee ?? 0, workerFee: payment.workerFee ?? 0, platformFee: payment.platformFee ?? 0, employerCharge: payment.employerCharge ?? payment.amount, providerPayout: payment.providerPayout ?? payment.amount, policyVersion: payment.feePolicyVersion || 'legacy', currency: payment.currency || config.paymentCurrency },
      job: await jobView(job, null, undefined, resolved),
      createdAt: payment.createdAt, updatedAt: payment.updatedAt,
    };
  }

  function relatedJob(userId, job) {
    return job.ownerId === userId || job.providerId === userId;
  }

  function enforceJobState(job, expected) {
    if (!expected.includes(job.status)) {
      throw new HttpError(409, 'INVALID_STATE', `Job is ${job.status}; expected one of ${expected.join(', ')}`);
    }
  }

  async function createAudit(action, actorId, entityType, entityId, meta = {}) {
    const audit = { id: id(), action, actorId, entityType, entityId, meta, createdAt: now() };
    if (env.DATABASE_URL) return repo.insertAudit(audit);
    if (typeof legacy.insertAudit === 'function') return legacy.insertAudit(audit);
    throw new Error('Legacy audit adapter is required outside PostgreSQL runtime');
  }

  return { getProvider, categoryBy, publicUser, authUserView, categoryView, buildOfferCountMap, offerCountFor, jobView, paymentView, relatedJob, enforceJobState, createAudit };
}
