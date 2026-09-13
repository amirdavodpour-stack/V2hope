// Offer lifecycle routes.

export function createOfferRoutes({ authUser, readBody, sendJson, HttpError, requireFields, textField, moneyField, repo, legacy, id, getJob, enforceJobState, createAudit, now, jobView }) {
  return async function routeHandler(req, res, parts) {
    if (req.method === 'POST' && parts.length === 1) {
      const me = await authUser(req); const body = await readBody(req); requireFields(body, ['jobId', 'price']);
      const job = await getJob(String(body.jobId)); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
      if (job.ownerId === me.id) throw new HttpError(403, 'FORBIDDEN', 'Owners cannot submit offers to their own job');
      enforceJobState(job, ['PUBLISHED']);
      const price = moneyField(body.price, 'price');
      const message = body.message ? textField(body.message, 'message', { min: 1, max: 4000 }) : '';
      const existing = process.env.DATABASE_URL ? await repo.findPendingOffer(job.id,me.id) : legacy.findPending(job.id, me.id);
      if (existing) throw new HttpError(409, 'OFFER_EXISTS', 'You already have a pending offer for this job');
      const offerDraft = { id: (process.env.DATABASE_URL ? id : legacy.newId)(), jobId: job.id, providerId: me.id, price, message, status: 'PENDING', createdAt: now(), updatedAt: now() };
      let offer;
      try { offer = process.env.DATABASE_URL ? await repo.insertOffer(offerDraft) : legacy.create(offerDraft); }
      catch (error) { if (error?.code === 'OFFER_EXISTS') throw new HttpError(409, 'OFFER_EXISTS', 'You already have a pending offer for this job'); throw error; }
      await createAudit('OFFER_CREATE', me.id, 'offer', offer.id, { jobId: job.id }); return sendJson(res, 201, offer);
    }
    if (req.method === 'POST' && parts[2] === 'accept') {
      const me = await authUser(req); const offer = process.env.DATABASE_URL ? await repo.findOfferById(parts[1]) : legacy.findById(parts[1]); if (!offer) throw new HttpError(404, 'OFFER_NOT_FOUND', 'Offer not found');
      const job = await getJob(offer.jobId); if (!job || job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the job owner can accept an offer');
      enforceJobState(job, ['PUBLISHED']);
      if (process.env.DATABASE_URL) {
        const result = await repo.acceptOffer(offer.id, me.id);
        if (!result) throw new HttpError(404, 'OFFER_NOT_FOUND', 'Offer not found');
        await createAudit('OFFER_ACCEPT', me.id, 'offer', offer.id, { jobId: job.id });
        return sendJson(res, 200, { offer: result.offer, job: await jobView(result.job, me.id) });
      }
      const accepted = await legacy.accept(offer, job, () => createAudit('OFFER_ACCEPT', me.id, 'offer', offer.id, { jobId: job.id }));
      await legacy.save();
      return sendJson(res, 200, { offer: accepted.offer, job: await jobView(accepted.job, me.id) });
    }
    throw new HttpError(404, 'NOT_FOUND', 'Offer route not found');
  };
}
