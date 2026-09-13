import crypto from 'node:crypto';

/** Explicit test/offline adapter for the legacy payment runtime. */
export function createPaymentLegacyAdapter({ db, withTransaction, fundingJournal, refundJournal, releaseJournal, payoutJournal, now }) {
  const id = () => db.id();
  return Object.freeze({
    findByJob(jobId) { return db.collection.payments.find((p) => p.jobId === jobId) || null; },
    findByIdempotency(payerId, key) { return db.collection.payments.find((p) => p.payerId === payerId && p.idempotencyKey === key) || null; },
    listLedgerEntries(paymentId) { return db.collection.ledgerEntries.filter((e) => e.referenceId === paymentId); },
    choosePendingOffer(jobId) { return db.collection.offers.filter((o) => o.jobId === jobId && o.status === 'PENDING').sort((a, b) => a.price - b.price)[0] || null; },

    async fund({ job, payerId, providerId, chosenOfferId, amount, idempotencyKey, breakdown, createdAt }) {
      const paymentId = id();
      return withTransaction(async () => {
        const created = db.insert('payments', {
          id: paymentId, jobId: job.id, payerId, payeeId: providerId, amount,
          status: 'HELD', providerRef: `LOCAL-${paymentId}`, idempotencyKey,
          baseAmount: breakdown.baseAmount, employerFee: breakdown.employerFee,
          workerFee: breakdown.workerFee, platformFee: breakdown.platformFee,
          employerCharge: breakdown.employerCharge, providerPayout: breakdown.providerPayout,
          feePolicyVersion: breakdown.policyVersion, currency: breakdown.currency,
          createdAt, updatedAt: createdAt,
        });
        const journalId = id();
        for (const entry of fundingJournal(breakdown)) db.insert('ledgerEntries', {
          id: id(), journalId, referenceType: 'PAYMENT_FUND', referenceId: paymentId,
          account: entry.account, debit: entry.debit, credit: entry.credit,
          currency: breakdown.currency, createdAt,
        });
        if (chosenOfferId) {
          const offer = db.collection.offers.find((o) => o.id === chosenOfferId);
          if (offer && offer.status === 'PENDING') offer.status = 'ACCEPTED';
          for (const other of db.collection.offers) if (other.jobId === job.id && other.id !== chosenOfferId && other.status === 'PENDING') other.status = 'REJECTED';
          db.touch('offers');
        }
        job.status = 'FUNDED'; job.providerId = job.providerId || providerId; job.updatedAt = createdAt;
        db.touch('jobs');
        await db.save();
        return { payment: created, job, created: true };
      });
    },

    async refund({ payment, job, idempotencyKey, refundId, createdAt }) {
      return withTransaction(async () => {
        if (payment.status !== 'HELD') { const e = new Error('INVALID_PAYMENT_STATE'); e.code = 'INVALID_PAYMENT_STATE'; throw e; }
        if (idempotencyKey) {
          const prior = db.collection.refunds.find((r) => r.paymentId === payment.id && r.idempotencyKey === idempotencyKey);
          if (prior) return { refund: prior, payment };
        }
        const refund = db.insert('refunds', {
          id: refundId, paymentId: payment.id, amount: payment.amount, status: 'REFUNDED',
          providerRef: `LOCAL-REF-${refundId}`, idempotencyKey, createdAt, updatedAt: createdAt,
        });
        payment.status = 'REFUNDED'; payment.updatedAt = createdAt;
        job.status = job.providerId ? 'ASSIGNED' : 'PUBLISHED'; job.updatedAt = createdAt;
        const b = {
          baseAmount: payment.baseAmount || payment.amount,
          employerFee: payment.employerFee || 0, workerFee: payment.workerFee || 0,
          platformFee: payment.platformFee || 0, employerCharge: payment.employerCharge || payment.amount,
          providerPayout: payment.providerPayout || payment.amount, currency: payment.currency || 'USD',
        };
        const journalId = id();
        for (const entry of refundJournal(b)) db.insert('ledgerEntries', {
          id: id(), journalId, referenceType: 'PAYMENT_REFUND', referenceId: payment.id,
          account: entry.account, debit: entry.debit, credit: entry.credit, currency: b.currency, createdAt,
        });
        db.touch('payments', 'refunds', 'jobs', 'ledgerEntries');
        await db.save();
        return { refund, payment };
      });
    },

    async release({ payment, job, actorId, createAudit }) {
      return withTransaction(async () => {
        payment.status = 'RELEASED'; payment.updatedAt = now();
        job.status = 'SETTLED'; job.updatedAt = now();
        const b = {
          baseAmount: payment.baseAmount || payment.amount,
          employerFee: payment.employerFee || 0, workerFee: payment.workerFee || 0,
          platformFee: payment.platformFee || 0, employerCharge: payment.employerCharge || payment.amount,
          providerPayout: payment.providerPayout || payment.amount, currency: payment.currency || 'USD',
        };
        for (const journal of [releaseJournal(b), payoutJournal(b)]) {
          const journalId = id();
          for (const entry of journal) db.insert('ledgerEntries', {
            id: id(), journalId, referenceType: 'PAYMENT_RELEASE', referenceId: payment.id,
            account: entry.account, debit: entry.debit, credit: entry.credit, currency: b.currency, createdAt: now(),
          });
        }
        db.insert('settlements', {
          id: id(), paymentId: payment.id, providerRef: payment.providerRef,
          amount: b.providerPayout, currency: b.currency, status: 'RELEASED', createdAt: now(), updatedAt: now(),
        });
        db.touch('payments', 'jobs', 'ledgerEntries', 'settlements');
        await createAudit('PAYMENT_RELEASE', actorId, 'payment', payment.id, { jobId: job.id });
        await db.save();
        return { payment, job };
      });
    },
  });
}
