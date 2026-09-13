/** Explicit test-runtime adapter for offer persistence. */
export function createOfferLegacyAdapter({ db, id, now, withTransaction }) {
  return Object.freeze({
    findPending(jobId, providerId) {
      return db.collection.offers.find((o) => o.jobId === jobId && o.providerId === providerId && o.status === 'PENDING') || null;
    },
    findById(offerId) { return db.collection.offers.find((o) => o.id === offerId) || null; },
    create(draft) { return db.insert('offers', draft); },
    async accept(offer, job, audit) {
      return withTransaction(async () => {
        offer.status = 'ACCEPTED'; offer.updatedAt = now();
        job.providerId = offer.providerId; job.status = 'ASSIGNED'; job.updatedAt = now();
        for (const other of db.collection.offers.filter((o) => o.jobId === job.id && o.id !== offer.id && o.status === 'PENDING')) { other.status = 'REJECTED'; other.updatedAt = now(); }
        db.touch('offers', 'jobs');
        await audit();
        return { offer, job };
      });
    },
    newId() { return id(); },
    async save() { await db.save(); },
  });
}
