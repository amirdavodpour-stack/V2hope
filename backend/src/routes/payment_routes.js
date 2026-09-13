import crypto from 'node:crypto';
import { validateIdempotencyPair, paymentAmountForJob, mapPaymentMutationError } from '../application/payment_policy.js';
import { verifyPaymentWebhookSignature, normalizePaymentWebhookBody, applyLocalPaymentWebhook } from '../application/payment_webhook.js';
export function createPaymentRoutes({
  authUser, readBody, readRawBody, sendJson, HttpError, config, db, repo, getJob,
  enforceJobState, readIdempotencyKey, requireFields, enumField, paymentView, relatedJob, withTransaction, createAudit,
  calculatePaymentBreakdown, fundingJournal, releaseJournal, payoutJournal, refundJournal, paymentUseCases,
  processPaymentCreateHoldNow, processPaymentReleaseNow, processPaymentRefundNow, paymentLegacy,
  notifyUser, NOTIFICATION_TYPES, logEvent, now,
}) {
  return async function paymentRoutes(req, res, parts) {
  if (req.method === 'POST' && parts[1] === 'webhook' && parts.length === 2) {
    if (!config.paymentWebhookSecret) throw new HttpError(503, 'PAYMENT_WEBHOOK_NOT_CONFIGURED', 'Payment webhook is not configured');
    const raw = await readRawBody(req);
    const signature = String(req.headers['x-hope-signature'] || '').trim();
    const timestamp = String(req.headers['x-hope-timestamp'] || '').trim();
    const eventId = String(req.headers['x-hope-event-id'] || '').trim();
    // Verification delegates to crypto.timingSafeEqual inside the policy module; persistence remains atomic in the repository transaction.
    if (!verifyPaymentWebhookSignature(raw, signature, config.paymentWebhookSecret, { timestamp, eventId, maxAgeSeconds: config.paymentWebhookMaxAgeSeconds })) {
      throw new HttpError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Invalid payment webhook signature');
    }
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'INVALID_JSON', 'Invalid JSON body'); }
    const event = normalizePaymentWebhookBody(body, { requireFields, enumField });
    if (event.eventId !== eventId) throw new HttpError(400, 'EVENT_ID_MISMATCH', 'Webhook eventId does not match the signed event id');
    const result = process.env.DATABASE_URL
      ? await paymentUseCases.applyWebhook(event)
      : await applyLocalPaymentWebhook({ event, db, withTransaction, config, releaseJournal, payoutJournal, now });
    return sendJson(res, 200, result);
  }
  if (req.method === 'GET' && parts[1] === 'jobs' && parts[2]) {
    const me = await authUser(req); const job = await getJob(parts[2]); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (!relatedJob(me.id, job)) throw new HttpError(403, 'FORBIDDEN', 'You are not a participant in this job');
    const payment = process.env.DATABASE_URL ? await paymentUseCases.findByJob(job.id) : paymentLegacy.findByJob(job.id); return sendJson(res, 200, await paymentView(payment, job));
  }
  if (req.method === 'GET' && parts[1] === 'financials' && parts[2]) {
    const me = await authUser(req); const job = await getJob(parts[2]); if (!job) throw new HttpError(404,'JOB_NOT_FOUND','Job not found');
    if (!relatedJob(me.id, job) && me.role !== 'ADMIN') throw new HttpError(403,'FORBIDDEN','You are not a participant in this job');
    const payment = process.env.DATABASE_URL ? await paymentUseCases.findByJob(job.id) : paymentLegacy.findByJob(job.id);
    const ledger = payment && process.env.DATABASE_URL ? await repo.listLedgerEntriesForPayment(payment.id) : (payment ? paymentLegacy.listLedgerEntries(payment.id) : []);
    return sendJson(res,200,{payment:payment?await paymentView(payment,job):await paymentView(null,job),ledger});
  }
  if (req.method === 'POST' && parts[1] === 'fund' && parts[2]) {
    const me = await authUser(req); const body = await readBody(req); const job = await getJob(parts[2]); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can fund a job');
    // Check for an already-completed fund (repeat request / retried idempotency
    // key) BEFORE the state guard: by the time a retry arrives the job is no
    // longer PUBLISHED/ASSIGNED (it's already FUNDED), so enforceJobState would
    // otherwise reject the retry with 409 instead of returning the original
    // payment, defeating the point of the idempotency key.
    const headerIdempotencyKey = readIdempotencyKey(req, config.maxIdempotencyKeyLength);
    const bodyIdempotencyKey = String(body?.idempotencyKey || '').trim();
    // Stable error contracts retained at the HTTP boundary: `INVALID_IDEMPOTENCY_KEY`, `Header and body idempotency keys must match`, `IDEMPOTENCY_CONFLICT`.
    // normalization itself lives in the application policy module.
    const idempotencyKey = validateIdempotencyPair({
      headerKey: headerIdempotencyKey,
      bodyKey: bodyIdempotencyKey,
      maxLength: config.maxIdempotencyKeyLength,
    });
    // PERF: previously fetched the same payment row twice in a row (once as
    // `existing` to decide whether to short-circuit, once as `existingPayment`
    // a few lines later for the enforceJobState check) with nothing in
    // between that could change the result. One fetch now serves both: by
    // the time the DB-mode branch below falls through without returning, the
    // only payment states left standing are HOLD_FAILED (fund retry) or RELEASE_FAILED (release retry) when reaching their respective endpoints
    // either returns or throws), which is exactly what enforceJobState needs.
    let existing;
    if (process.env.DATABASE_URL) {
      existing = await paymentUseCases.findByJob(job.id);
      if (existing) {
        if (idempotencyKey && existing.idempotencyKey && existing.idempotencyKey !== idempotencyKey) throw new HttpError(409, 'PAYMENT_ALREADY_EXISTS', 'A payment already exists for this job');
        if (existing.status === 'HELD' || existing.status === 'RELEASE_PENDING' || existing.status === 'RELEASED') return sendJson(res,200,await paymentView(existing,job));
        if (existing.status === 'HOLD_PENDING') return sendJson(res,202,{...(await paymentView(existing,job)), settlement:{status:'PENDING',outboxEventId:null}});
        if (existing.status !== 'HOLD_FAILED') throw new HttpError(409,'INVALID_PAYMENT_STATE','Payment cannot be funded from its current state');
      }
    } else {
      existing = paymentLegacy.findByJob(job.id);
      if(existing) {
        if (idempotencyKey && existing.idempotencyKey && existing.idempotencyKey !== idempotencyKey) {
          throw new HttpError(409, 'PAYMENT_ALREADY_EXISTS', 'A payment already exists for this job');
        }
        if (existing.status === 'HELD' || existing.status === 'RELEASE_PENDING' || existing.status === 'RELEASED') {
          return sendJson(res,200,await paymentView(existing,job));
        }
        if (existing.status === 'HOLD_PENDING') {
          return sendJson(res,202,{...(await paymentView(existing,job)),settlement:{status:'PENDING',outboxEventId:null}});
        }
        if (existing.status !== 'HOLD_FAILED') {
          throw new HttpError(409,'INVALID_PAYMENT_STATE','Payment cannot be funded from its current state');
        }
      }
      if(idempotencyKey){const prior=paymentLegacy.findByIdempotency(me.id, idempotencyKey); if(prior) return sendJson(res,200,await paymentView(prior,job));}
    }
    enforceJobState(job, existing?.status === 'HOLD_FAILED' ? ['FUNDED'] : ['PUBLISHED', 'ASSIGNED']);
    let providerId = job.providerId;
    let chosenOfferId = null;
    if (!providerId) {
      const chosen = process.env.DATABASE_URL ? (await repo.listOffersForJob(job.id)).filter((o)=>o.status==='PENDING').sort((a,b)=>a.price-b.price)[0] : paymentLegacy.choosePendingOffer(job.id);
      if (!chosen) throw new HttpError(409, 'PROVIDER_REQUIRED', 'Accept an offer before funding the job');
      chosenOfferId = chosen.id; providerId = chosen.providerId;
    }
    if (!providerId) throw new HttpError(409, 'PROVIDER_REQUIRED', 'A provider is required before funding');
    const amount = paymentAmountForJob(job);
    const breakdown = calculatePaymentBreakdown(job.kind || (job.jobType === 'FIXED' ? 'MISSION' : 'JOB'), amount);
    const createdAt = now();
    const paymentId = crypto.randomUUID();
    let funded;
    try {
      funded = process.env.DATABASE_URL ? await paymentUseCases.fund({ jobId:job.id, payerId:me.id, payeeId:providerId, offerId: chosenOfferId, amount, id:paymentId, idempotencyKey, createdAt, breakdown }) : await paymentLegacy.fund({ job, payerId:me.id, providerId, chosenOfferId, amount, idempotencyKey, breakdown, createdAt });
    } catch (error) {
      throw mapPaymentMutationError(error);
    }
    if (!funded) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    const payment = funded.payment;
    const finalJob = funded.job;
    if (process.env.DATABASE_URL) {
      try { await processPaymentCreateHoldNow(); } catch (error) { logEvent({ level:'warn', action:'PAYMENT_CREATE_HOLD_WORKER_TRIGGER_FAILED', paymentId:payment.id, error:error.message }); }
      const refreshed = await paymentUseCases.findByJob(job.id);
      const refreshedJob = await repo.findJobById(job.id);
      if (refreshed?.status === 'HELD') { await notifyUser({userId:providerId,type:NOTIFICATION_TYPES.PAYMENT_UPDATE,title:'پرداخت با موفقیت انجام شد',body:`پرداخت مرتبط با «${job.title}» با موفقیت در حالت نگهداری قرار گرفت.`,data:{jobId:job.id,paymentId:refreshed.id,status:refreshed.status},dedupeKey:`payment:${refreshed.id}:HELD`,channels:['IN_APP','PUSH']}); return sendJson(res, funded.created ? 201 : 200, await paymentView(refreshed, refreshedJob)); }
      return sendJson(res, funded.created ? 202 : 202, { ...(await paymentView(refreshed || payment, refreshedJob || finalJob)), settlement:{status:'PENDING',outboxEventId:funded.outboxEvent?.id || null} });
    }
    await notifyUser({userId:providerId,type:NOTIFICATION_TYPES.PAYMENT_UPDATE,title:'پرداخت ماموریت ثبت شد',body:`پرداخت مربوط به «${job.title}» ثبت شد.`,data:{jobId:job.id,paymentId:payment.id,status:payment.status},dedupeKey:`payment:${payment.id}:HELD`,channels:['IN_APP','PUSH']});
    await createAudit('PAYMENT_FUND', me.id, 'payment', payment.id, { jobId: job.id });
    return sendJson(res, 201, await paymentView(payment, finalJob));
  }
  if (req.method === 'POST' && parts[1] === 'refund' && parts[2]) {
    const me=await authUser(req); const body=await readBody(req); const job=await getJob(parts[2]); if(!job)throw new HttpError(404,'JOB_NOT_FOUND','Job not found');
    if(job.ownerId!==me.id)throw new HttpError(403,'FORBIDDEN','Only the owner can refund payment');
    const payment=process.env.DATABASE_URL?await paymentUseCases.findByJob(job.id):paymentLegacy.findByJob(job.id); if(!payment)throw new HttpError(409,'PAYMENT_REQUIRED','No payment exists for this job');
    const idempotencyKey=readIdempotencyKey(req, config.maxIdempotencyKeyLength); const createdAt=now(); const refundId=crypto.randomUUID();
    let created;
    try {
      created=process.env.DATABASE_URL?await paymentUseCases.refund({jobId:job.id,paymentId:payment.id,ownerId:me.id,amount:payment.amount,id:refundId,idempotencyKey,createdAt}):await paymentLegacy.refund({ payment, job, idempotencyKey, refundId, createdAt });
    } catch(e){ if(e.code==='INVALID_PAYMENT_STATE')throw new HttpError(409,'INVALID_PAYMENT_STATE','Payment cannot be refunded from its current state'); if(e.code==='PARTIAL_REFUND_UNSUPPORTED')throw new HttpError(400,'PARTIAL_REFUND_UNSUPPORTED','Only full refunds are currently supported'); throw e; }
    if(process.env.DATABASE_URL){ try{await processPaymentRefundNow();}catch(error){logEvent({level:'warn',action:'PAYMENT_REFUND_WORKER_TRIGGER_FAILED',paymentId:payment.id,error:error.message});} const refreshed=await paymentUseCases.findByJob(job.id); return sendJson(res,created.refund.status==='PENDING'?202:200,{...(await paymentView(refreshed||created.payment,await repo.findJobById(job.id))),refund:created.refund}); }
    await createAudit('PAYMENT_REFUND',me.id,'payment',payment.id,{jobId:job.id}); return sendJson(res,200,{...(await paymentView(created.payment,job)),refund:created.refund});
  }
  if (req.method === 'POST' && parts[1] === 'release' && parts[2]) {
    const me = await authUser(req); const job = await getJob(parts[2]); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can release payment');
    enforceJobState(job, ['COMPLETED']);
    const payment = process.env.DATABASE_URL ? await paymentUseCases.findByJob(job.id) : paymentLegacy.findByJob(job.id); if (!payment || !['RELEASE_PENDING','RELEASE_FAILED'].includes(payment.status)) throw new HttpError(409, 'INVALID_PAYMENT_STATE', 'Payment is not ready for release');
    if (process.env.DATABASE_URL) {
      const event = await paymentUseCases.release({ jobId:job.id, ownerId:me.id, paymentId:payment.id, dedupeKey:`PAYMENT_RELEASE:${payment.id}` });
      try { await processPaymentReleaseNow(); } catch (error) { logEvent({ level:'warn', action:'PAYMENT_RELEASE_WORKER_TRIGGER_FAILED', paymentId:payment.id, error:error.message }); }
      const refreshed = await paymentUseCases.findByJob(job.id);
      const finalJob = await repo.findJobById(job.id);
      if (refreshed?.status === 'RELEASED') { await notifyUser({userId:refreshed.payeeId,type:NOTIFICATION_TYPES.PAYMENT_UPDATE,title:'پرداخت تسویه شد',body:`پرداخت مربوط به «${job.title}» تسویه شد.`,data:{jobId:job.id,paymentId:refreshed.id,status:refreshed.status},dedupeKey:`payment:${refreshed.id}:RELEASED`,channels:['IN_APP','PUSH','EMAIL']}); return sendJson(res, 200, await paymentView(refreshed, finalJob)); }
      return sendJson(res, 202, { ...(await paymentView(refreshed, finalJob)), settlement: { status:'PENDING', outboxEventId:event?.id || null } });
    }
    await paymentLegacy.release({ payment, job, actorId: me.id, createAudit });
    await notifyUser({userId:payment.payeeId,type:NOTIFICATION_TYPES.PAYMENT_UPDATE,title:'پرداخت تسویه شد',body:`پرداخت مربوط به «${job.title}» تسویه شد.`,data:{jobId:job.id,paymentId:payment.id,status:payment.status},dedupeKey:`payment:${payment.id}:RELEASED`,channels:['IN_APP','PUSH','EMAIL']});
    return sendJson(res, 200, await paymentView(payment, job));
  }
  throw new HttpError(404, 'NOT_FOUND', 'Payment route not found');
  };
}
