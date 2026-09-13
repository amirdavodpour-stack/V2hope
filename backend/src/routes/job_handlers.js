import { URL } from 'node:url';

export async function handleList(ctx, req, res, parts, user) {
  // Only the fields this handler actually uses are pulled from ctx (was a
  // 29-field destructure shared verbatim across every handler in this file).
  const {
    legacyJobs, repo, jobUseCases, sendJson, HttpError, textField, enumField,
    JOB_KINDS, JOB_VISIBILITY, categoryBy, jobView, buildOfferCountMap,
  } = ctx;
  const searchParams = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
  const status = searchParams.get('status') || 'PUBLISHED';
  const kindFilter = searchParams.get('kind') ? enumField(searchParams.get('kind'), JOB_KINDS, 'kind') : null;
  const visibilityFilter = searchParams.get('visibility') ? enumField(searchParams.get('visibility'), JOB_VISIBILITY, 'visibility') : null;
  const cityFilter = searchParams.get('city') ? textField(searchParams.get('city'), 'city', { min: 1, max: 120 }) : null;
  const categoryFilter = searchParams.get('categoryId') ? String(searchParams.get('categoryId')).trim() : null;
  const searchQuery = searchParams.get('q') ? textField(searchParams.get('q'), 'q', { min: 1, max: 120 }) : null;
  if (status !== 'PUBLISHED' && !user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required to view private job states');
  }
  if (process.env.DATABASE_URL) {
    const rows = await jobUseCases.list({
      status,
      userId: status === 'PUBLISHED' ? null : user?.id,
      kind: kindFilter,
      visibility: visibilityFilter,
      city: cityFilter,
      categoryId: categoryFilter,
      search: searchQuery,
    });
    const views = await Promise.all(rows.map(({job,category,owner,provider,offerCount}) =>
      jobView(job, user?.id, new Map([[job.id, offerCount]]), { owner, provider, category })
    ));
    return sendJson(res, 200, views);
  }
  const jobs = legacyJobs.list({ status, user, kindFilter, visibilityFilter, cityFilter, categoryFilter, searchQuery });
  const offerCountByJob = buildOfferCountMap();
  return sendJson(res, 200, await Promise.all(jobs.map((j) => jobView(j, user?.id, offerCountByJob))));
}
export async function handleCreate(ctx, req, res, parts, user) {
  const {
    authUser, id, repo, legacyJobs, jobUseCases, readBody, sendJson, HttpError, requireFields,
    textField, moneyField, enumField, JOB_TYPES, JOB_KINDS, JOB_VISIBILITY,
    JOB_SCHEDULES, BUDGET_TYPES, dateOnlyField, categoryBy, jobView,
    createAudit, now,
  } = ctx;
  const me = await authUser(req);
  const body = await readBody(req);
  requireFields(body, ['title', 'description', 'categoryId', 'jobType', 'budgetType', 'budgetMin', 'budgetMax', 'duration', 'acceptanceCriteria']);
  const title = textField(body.title, 'title', { min: 2, max: 160, required: true });
  const description = textField(body.description, 'description', { min: 2, max: 8000, required: true });
  const acceptanceCriteria = textField(body.acceptanceCriteria, 'acceptanceCriteria', { min: 2, max: 5000, required: true });
  const jobType = enumField(body.jobType, JOB_TYPES, 'jobType');
  const budgetType = enumField(body.budgetType, BUDGET_TYPES, 'budgetType');
  const kind = enumField(body.kind || (jobType === 'FIXED' ? 'MISSION' : 'JOB'), JOB_KINDS, 'kind');
  const visibility = enumField(body.visibility || 'PUBLIC', JOB_VISIBILITY, 'visibility');
  const schedule = body.schedule ? enumField(body.schedule, JOB_SCHEDULES, 'schedule') : null;
  if (kind === 'JOB' && !schedule) throw new HttpError(400, 'INVALID_SCHEDULE', 'schedule is required for jobs');
  const monthlySalary = body.monthlySalary == null || body.monthlySalary === '' ? null : moneyField(body.monthlySalary, 'monthlySalary');
  const applicationDeadline = body.applicationDeadline ? dateOnlyField(body.applicationDeadline, 'applicationDeadline') : null;
  if (kind === 'JOB' && !monthlySalary) throw new HttpError(400, 'INVALID_SALARY', 'monthlySalary is required for jobs');
  if (kind === 'JOB' && !applicationDeadline) throw new HttpError(400, 'INVALID_DEADLINE', 'applicationDeadline is required for jobs');
  if (kind === 'MISSION' && (monthlySalary || applicationDeadline || schedule)) throw new HttpError(400, 'INVALID_KIND_FIELDS', 'Mission cannot include job-only fields');
  const budgetMin = moneyField(body.budgetMin, 'budgetMin');
  const budgetMax = moneyField(body.budgetMax, 'budgetMax');
  const duration = Number(body.duration);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 36500) throw new HttpError(400, 'INVALID_DURATION', 'Duration must be a positive integer within range');
  if (budgetMin > budgetMax) throw new HttpError(400, 'INVALID_BUDGET', 'Maximum budget must be greater than or equal to minimum budget');
  const categoryExists = process.env.DATABASE_URL ? await repo.findCategoryByIdOrSlug(String(body.categoryId)) : categoryBy(String(body.categoryId));
  if (!categoryExists) throw new HttpError(400, 'INVALID_CATEGORY', 'Category does not exist');
  const draft = {
    id: id(), ownerId: me.id, providerId: null, title, description,
    categoryId: String(body.categoryId), jobType, budgetType, budgetMin, budgetMax, duration,
    acceptanceCriteria, status: 'DRAFT', city: body.city ? textField(body.city, 'city', { min: 1, max: 120 }) : null, kind, visibility, schedule, monthlySalary, applicationDeadline,
    createdAt: now(), updatedAt: now(), publishedAt: null,
  };
  const created = process.env.DATABASE_URL ? await jobUseCases.create(draft) : legacyJobs.createJob(draft);
  await createAudit('JOB_CREATE', me.id, 'job', created.id);
  return sendJson(res, 201, await jobView(created, me.id));
}
export async function handleMine(ctx, req, res, parts, user) {
  const { authUser, db, repo, legacyJobs, sendJson, jobView, paymentView, buildOfferCountMap } = ctx;
  const me = await authUser(req);
  if (process.env.DATABASE_URL) {
    const rows = await repo.listMyJobViews(me.id);
    const views = await Promise.all(rows.map(async ({job,category,owner,provider,offerCount,payment}) => {
      const resolved = { owner, provider, category };
      return {
        ...(await jobView(job, me.id, new Map([[job.id, offerCount]]), resolved)),
        transaction: payment ? await paymentView(payment, job, resolved) : null,
      };
    }));
    return sendJson(res, 200, views);
  }
  const jobs = legacyJobs.listMine(me.id);
  const offerCountByJob = buildOfferCountMap();
  const views = await Promise.all(jobs.map(async (job) => {
    const payment = legacyJobs.findPaymentByJob(job.id);
    return { ...(await jobView(job, me.id, offerCountByJob)), transaction: payment ? await paymentView(payment, job) : null };
  }));
  return sendJson(res, 200, views);
}
export async function handleJobActions(ctx, req, res, parts, job) {
  const {
    authUser, id, repo, legacyJobs, jobUseCases, readBody, sendJson, HttpError, requireFields,
    textField, jobView, enforceJobState, createAudit, now,
  } = ctx;
  const user = req.headers.authorization ? await authUser(req) : null;
  if (req.method === 'POST' && parts[2] === 'publish') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can publish this job');
    enforceJobState(job, ['DRAFT']);
    let updatedJob;
    if (process.env.DATABASE_URL) {
      updatedJob = await jobUseCases.publish(job.id, now());
    } else {
      job.status = 'PUBLISHED';
      job.publishedAt = now();
      job.updatedAt = now();
      legacyJobs.touch('jobs');
      await legacyJobs.save();
      updatedJob = job;
    }
    await createAudit('JOB_PUBLISH', me.id, 'job', job.id);
    await sendJson(res, 200, await jobView(updatedJob, me.id));
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'start') {
    const me = await authUser(req);
    if (job.providerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned provider can start this job');
    enforceJobState(job, ['FUNDED']);
    const payment = process.env.DATABASE_URL ? await repo.findPaymentByJob(job.id) : legacyJobs.findPaymentByJob(job.id);
    if (!payment || payment.status !== 'HELD') throw new HttpError(409, 'PAYMENT_REQUIRED', 'Job must be funded before starting');
    let updatedJob;
    if (process.env.DATABASE_URL) {
      updatedJob = await jobUseCases.start(job.id, now());
    } else {
      job.status = 'IN_PROGRESS';
      job.updatedAt = now();
      legacyJobs.touch('jobs');
      await legacyJobs.save();
      updatedJob = job;
    }
    await createAudit('JOB_START', me.id, 'job', job.id);
    await sendJson(res, 200, await jobView(updatedJob, me.id));
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'deliver') {
    const me = await authUser(req);
    if (job.providerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned provider can deliver');
    enforceJobState(job, ['IN_PROGRESS']);
    let updatedJob;
    if (process.env.DATABASE_URL) {
      updatedJob = await jobUseCases.deliver(job.id, now());
    } else {
      job.status = 'DELIVERED';
      job.updatedAt = now();
      legacyJobs.touch('jobs');
      await legacyJobs.save();
      updatedJob = job;
    }
    await createAudit('JOB_DELIVER', me.id, 'job', job.id);
    await sendJson(res, 200, await jobView(updatedJob, me.id));
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'accept') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can accept delivery');
    enforceJobState(job, ['DELIVERED', 'UNDER_REVIEW']);
    const payment = process.env.DATABASE_URL ? await repo.findPaymentByJob(job.id) : legacyJobs.findPaymentByJob(job.id);
    if (!payment || payment.status !== 'HELD') throw new HttpError(409, 'PAYMENT_REQUIRED', 'Payment is not held');
    if (process.env.DATABASE_URL) {
      const result = await jobUseCases.accept(job.id, now());
      await createAudit('JOB_ACCEPT', me.id, 'job', job.id);
      await sendJson(res, 200, await jobView(result.job, me.id));
      return true;
    }
    job.status = 'COMPLETED';
    job.updatedAt = now();
    payment.status = 'RELEASE_PENDING';
    payment.updatedAt = now();
    legacyJobs.touch('jobs', 'payments');
    await legacyJobs.save();
    await createAudit('JOB_ACCEPT', me.id, 'job', job.id);
    await sendJson(res, 200, await jobView(job, me.id));
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'evidence') {
    const me = await authUser(req);
    if (job.providerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned provider can submit evidence');
    enforceJobState(job, ['IN_PROGRESS']);
    const body = await readBody(req);
    requireFields(body, ['uri']);
    let uri = String(body.uri).trim();
    const isStorageRef = /^storage:\/\/[A-Za-z0-9._~:/%-]+$/.test(uri);
    if (!isStorageRef) {
      let parsedUri;
      try {
        parsedUri = new URL(uri);
      } catch {
        throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Evidence URI is invalid');
      }
      if (!['https:', 'http:'].includes(parsedUri.protocol)) throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Evidence URI must use HTTP or HTTPS');
    }
    if (uri.length > 2048) throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Evidence URI is too long');
    const notes = textField(body.notes, 'notes', { min: 0, max: 2000 });
    const type = textField(body.type || 'DELIVERY_LINK', 'type', { min: 2, max: 80, required: true });
    const storageKey = isStorageRef ? uri.slice('storage://'.length) : null;
    if (storageKey && (storageKey.includes('..') || storageKey.startsWith('/') || storageKey.includes('\\'))) {
      throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Storage reference is invalid');
    }
    const evidenceDraft = { id: id(), jobId: job.id, submittedBy: me.id, uri, storageKey, notes, type, createdAt: now() };
    let evidence;
    if (process.env.DATABASE_URL) {
      try {
        evidence = await repo.insertEvidenceAndTouchJob(evidenceDraft);
      } catch (error) {
        if (error?.code === 'INVALID_STORAGE_REFERENCE') throw new HttpError(403, 'INVALID_STORAGE_REFERENCE', 'Storage reference does not belong to this user');
        if (error?.code === 'INVALID_STATE') throw new HttpError(409, 'INVALID_STATE', 'Job is no longer accepting evidence');
        throw error;
      }
    } else {
      if (storageKey && !legacyJobs.listUploadsForUser(me.id, storageKey)) {
        throw new HttpError(403, 'INVALID_STORAGE_REFERENCE', 'Storage reference does not belong to this user');
      }
      evidence = legacyJobs.insertEvidence(evidenceDraft);
      job.updatedAt = evidenceDraft.createdAt;
      legacyJobs.touch('jobs');
      await legacyJobs.save();
    }
    if (!evidence) throw new HttpError(409, 'INVALID_STATE', 'Job is no longer accepting evidence');
    await createAudit('EVIDENCE_CREATE', me.id, 'evidence', evidence.id, { jobId: job.id });
    await sendJson(res, 201, evidence);
    return true;
  }
}
export async function handleCandidateRoutes(ctx, req, res, parts, job) {
  const {
    authUser, db, repo, legacyJobs, readBody, sendJson, HttpError, textField,
    createAudit, now, findUser, publicUser, notifyApplicationCandidate,
    NOTIFICATION_TYPES,
  } = ctx;
  if (req.method === 'POST' && parts[2] === 'candidates' && parts[4] === 'compare') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the job owner can compare candidates');
    if (job.kind !== 'JOB') throw new HttpError(400, 'JOB_ONLY', 'Candidate comparison is only for jobs');
    const body = await readBody(req);
    const ids = Array.isArray(body?.applicationIds) ? body.applicationIds.filter(Boolean).slice(0, 5) : [];
    if (!ids.length) throw new HttpError(400, 'VALIDATION_ERROR', 'applicationIds is required');
    const rows = process.env.DATABASE_URL
      ? await repo.listCandidatesForComparison(job.id, ids)
      : legacyJobs.listCandidates(job.id, ids);
    const result = rows.map((a) => ({
      id: a.id,
      skills: a.skills || '',
      resumeHighlights: String(a.resumeText || '').slice(0, 500),
      status: a.status,
      experience: null,
      education: null,
      identityMasked: true,
    }));
    await createAudit('JOB_CANDIDATE_COMPARE', me.id, 'job', job.id, { applicationIds: ids, count: result.length });
    await sendJson(res, 200, { candidates: result });
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'report') {
    const me = await authUser(req);
    const body = await readBody(req);
    const reason = textField(body?.reason, 'reason', { min: 3, max: 120, required: true });
    const details = textField(body?.details, 'details', { min: 0, max: 2000 });
    const report = { id: id(), reporterId: me.id, entityType: 'JOB', entityId: job.id, reason, details, status: 'OPEN', createdAt: now(), updatedAt: now() };
    const created = process.env.DATABASE_URL ? await repo.insertTrustReport(report) : legacyJobs.insertTrustReport(report);
    if (!process.env.DATABASE_URL) await legacyJobs.save();
    await createAudit('TRUST_REPORT_CREATE', me.id, 'job', job.id, { reason });
    await sendJson(res, 201, { id: created.id, status: created.status });
    return true;
  }
  if (req.method === 'GET' && parts[2] === 'candidates') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the job owner can view forwarded candidates');
    if ((job.kind || (job.jobType === 'FIXED' ? 'MISSION' : 'JOB')) !== 'JOB') throw new HttpError(400, 'JOB_ONLY', 'Candidates exist only for jobs');
    const candidates = process.env.DATABASE_URL
      ? await repo.listSelectedCandidatesForJob(job.id)
      : legacyJobs.selectedCandidates(job.id);
    await sendJson(res, 200, candidates.map(({ candidateId, email, displayName, ...safe }) => safe));
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'candidates' && parts[4] === 'interview') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the job owner can schedule interviews');
    if (job.kind !== 'JOB') throw new HttpError(400, 'JOB_ONLY', 'Interviews are only for jobs');
    let changed;
    try {
      changed = process.env.DATABASE_URL
        ? await repo.transitionEmployerApplication(parts[3], me.id, ['FORWARDED'], 'INTERVIEW', job.id)
        : (() => {
            const a = legacyJobs.findApplication(parts[3]);
            if (a && a.jobId !== job.id) { const e = new Error('APPLICATION_JOB_MISMATCH'); e.code = 'APPLICATION_JOB_MISMATCH'; throw e; }
            if (!a || a.status !== 'FORWARDED') return null;
            a.status = 'INTERVIEW'; a.updatedAt = now(); legacyJobs.touch('jobApplications'); return a;
          })();
    } catch (error) {
      if (error?.code === 'APPLICATION_JOB_MISMATCH') throw new HttpError(409,'APPLICATION_JOB_MISMATCH','Application does not belong to this job');
      throw error;
    }
    if (!changed) throw new HttpError(409, 'INVALID_APPLICATION_STATE', 'Application is not ready for interview');
    if (!process.env.DATABASE_URL) await legacyJobs.save();
    await notifyApplicationCandidate(changed.id, NOTIFICATION_TYPES.INTERVIEW_SCHEDULED, 'برای شما مصاحبه تنظیم شد', `برای شغل «${job.title}» وارد مرحله مصاحبه شده‌اید.`);
    await createAudit('JOB_APPLICATION_INTERVIEW', me.id, 'job_application', parts[3], { jobId: job.id });
    await sendJson(res, 200, { id: changed.id, status: changed.status });
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'candidates' && parts[4] === 'offer') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the job owner can make offers');
    if (job.kind !== 'JOB') throw new HttpError(400, 'JOB_ONLY', 'Offers are only for jobs');
    let changed;
    try {
      changed = process.env.DATABASE_URL
        ? await repo.transitionEmployerApplication(parts[3], me.id, ['INTERVIEW'], 'OFFERED', job.id)
        : (() => {
            const a = legacyJobs.findApplication(parts[3]);
            if (a && a.jobId !== job.id) { const e = new Error('APPLICATION_JOB_MISMATCH'); e.code = 'APPLICATION_JOB_MISMATCH'; throw e; }
            if (!a || a.status !== 'INTERVIEW') return null;
            a.status = 'OFFERED'; a.updatedAt = now(); legacyJobs.touch('jobApplications'); return a;
          })();
    } catch (error) {
      if (error?.code === 'APPLICATION_JOB_MISMATCH') throw new HttpError(409,'APPLICATION_JOB_MISMATCH','Application does not belong to this job');
      throw error;
    }
    if (!changed) throw new HttpError(409, 'INVALID_APPLICATION_STATE', 'Application is not ready for an offer');
    if (!process.env.DATABASE_URL) await legacyJobs.save();
    await notifyApplicationCandidate(changed.id, NOTIFICATION_TYPES.OFFER_RECEIVED, 'یک پیشنهاد شغلی دریافت کردید', `کارفرما برای شغل «${job.title}» به شما پیشنهاد داده است.`);
    await createAudit('JOB_APPLICATION_OFFER', me.id, 'job_application', parts[3], { jobId: job.id });
    await sendJson(res, 200, { id: changed.id, status: changed.status });
    return true;
  }
  if (req.method === 'POST' && parts[2] === 'candidates' && parts[4] === 'hire') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the job owner can hire a candidate');
    if (job.kind !== 'JOB') throw new HttpError(400, 'JOB_ONLY', 'Hiring is only for jobs');
    let changed;
    try {
      changed = process.env.DATABASE_URL
        ? await repo.transitionEmployerApplication(parts[3], me.id, ['OFFERED'], 'ACCEPTED', job.id)
        : (() => {
            const a = legacyJobs.findApplication(parts[3]);
            if (a && a.jobId !== job.id) { const e = new Error('APPLICATION_JOB_MISMATCH'); e.code = 'APPLICATION_JOB_MISMATCH'; throw e; }
            if (!a || a.status !== 'OFFERED') return null;
            if (!['PUBLISHED', 'ASSIGNED'].includes(job.status)) {
              const e = new Error('JOB_NOT_HIRABLE');
              e.code = 'JOB_NOT_HIRABLE';
              throw e;
            }
            if (legacyJobs.hasAcceptedApplication(job.id, a.id)) {
              const e = new Error('CANDIDATE_ALREADY_HIRED');
              e.code = 'CANDIDATE_ALREADY_HIRED';
              throw e;
            }
            a.status = 'ACCEPTED';
            a.updatedAt = now();
            job.providerId = a.candidateId;
            job.status = 'ASSIGNED';
            job.updatedAt = now();
            legacyJobs.touch('jobApplications', 'jobs');
            return a;
          })();
    } catch (error) {
      if (error?.code === 'APPLICATION_JOB_MISMATCH') throw new HttpError(409, 'APPLICATION_JOB_MISMATCH', 'Application does not belong to this job');
      if (error?.code === 'CANDIDATE_ALREADY_HIRED') throw new HttpError(409, 'CANDIDATE_ALREADY_HIRED', 'Another candidate is already hired for this job');
      if (error?.code === 'JOB_NOT_HIRABLE') throw new HttpError(409, 'JOB_NOT_HIRABLE', 'Job is not available for hiring');
      throw error;
    }
    if (!changed) throw new HttpError(409, 'INVALID_APPLICATION_STATE', 'Application is not ready for hire');
    if (!process.env.DATABASE_URL) await legacyJobs.save();
    await notifyApplicationCandidate(changed.id, NOTIFICATION_TYPES.APPLICATION_ACCEPTED, 'استخدام شدید', `برای شغل «${job.title}» انتخاب شده‌اید.`);
    await createAudit('JOB_APPLICATION_HIRE', me.id, 'job_application', parts[3], { jobId: job.id });
    await sendJson(res, 200, { id: changed.id, status: changed.status });
    return true;
  }
  if (req.method === 'GET' && parts[2] === 'offers') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can view offers');
    if (process.env.DATABASE_URL) {
      await sendJson(res, 200, await repo.listOfferViewsForJob(job.id));
      return true;
    }
    const offers = legacyJobs.listOffers(job.id);
    await sendJson(res, 200, offers);
    return true;
  }
}
