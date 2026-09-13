/** Explicit test-only admin adapter over the legacy in-memory DB facade. */
export function createAdminLegacyAdapter({ db, findUser, now }) {
  return Object.freeze({
    financialSummary() {
      const payments = db.collection.payments;
      const refunds = db.collection.refunds;
      const settlements = db.collection.settlements;
      const ledgerEntries = db.collection.ledgerEntries;
      return {
        payments: payments.length,
        pending: payments.filter((p) => ['HOLD_PENDING','REFUND_PENDING','RELEASE_PENDING','RELEASE_FAILED'].includes(p.status)).length,
        held: payments.filter((p) => p.status === 'HELD').length,
        released: payments.filter((p) => p.status === 'RELEASED').length,
        refunded: payments.filter((p) => p.status === 'REFUNDED').length,
        platformFees: payments.reduce((s, p) => s + Number(p.platformFee || 0), 0),
        employerCharges: payments.reduce((s, p) => s + Number(p.employerCharge || p.amount || 0), 0),
        providerPayouts: payments.reduce((s, p) => s + Number(p.providerPayout || p.amount || 0), 0),
        refunds: refunds.length,
        settlements: settlements.length,
        ledgerEntries: ledgerEntries.length,
      };
    },
    summary() {
      const users = db.collection.users;
      const jobs = db.collection.jobs;
      const apps = db.collection.jobApplications;
      return {
        users: users.length,
        admins: users.filter((u) => u.role === 'ADMIN').length,
        active_users: users.filter((u) => u.role === 'USER' && u.status === 'ACTIVE').length,
        suspended_users: users.filter((u) => u.status !== 'ACTIVE').length,
        opportunities: jobs.length,
        published_opportunities: jobs.filter((j) => j.status === 'PUBLISHED').length,
        draft_opportunities: jobs.filter((j) => j.status === 'DRAFT').length,
        missions: jobs.filter((j) => j.kind === 'MISSION').length,
        jobs: jobs.filter((j) => j.kind === 'JOB').length,
        applications: apps.length,
        pending_applications: apps.filter((a) => ['PENDING','SHORTLISTED'].includes(a.status)).length,
        audit_events: db.collection.audit.length,
      };
    },
    users: () => db.collection.users.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    setUserStatus(id, status) {
      const user = db.collection.users.find((x) => x.id === id);
      if (!user) return null;
      user.status = status;
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      db.touch('users');
      return user;
    },
    trustReports(status) {
      return db.collection.trustReports
        .filter((r) => !status || r.status === status)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    updateTrustReportStatus(id, status) {
      const report = db.collection.trustReports.find((x) => x.id === id);
      if (!report) return null;
      report.status = status;
      report.updatedAt = now();
      db.touch('trustReports');
      return report;
    },
    audit() {
      return db.collection.audit
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((a) => ({ ...a, actorName: findUser(a.actorId)?.displayName || null }));
    },
    jobs: () => db.collection.jobs.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    moderateJob(id, status) {
      const job = db.collection.jobs.find((x) => x.id === id);
      if (!job) return null;
      if (['COMPLETED','ASSIGNED','FUNDED','IN_PROGRESS','DELIVERED','UNDER_REVIEW'].includes(job.status)) {
        const error = new Error('JOB_LOCKED');
        error.code = 'JOB_LOCKED';
        throw error;
      }
      job.status = status;
      job.updatedAt = now();
      if (status === 'PUBLISHED' && !job.publishedAt) job.publishedAt = now();
      db.touch('jobs');
      return job;
    },
    deleteJob(id) {
      const financial = db.collection.payments.find((p) => p.jobId === id);
      if (financial) {
        const error = new Error('JOB_HAS_FINANCIAL_RECORDS');
        error.code = 'JOB_HAS_FINANCIAL_RECORDS';
        throw error;
      }
      db.collection.jobs = db.collection.jobs.filter((j) => j.id !== id);
      db.collection.offers = db.collection.offers.filter((o) => o.jobId !== id);
      db.collection.jobApplications = db.collection.jobApplications.filter((a) => a.jobId !== id);
      db.collection.evidence = db.collection.evidence.filter((e) => e.jobId !== id);
      db.touch('jobs', 'offers', 'jobApplications', 'evidence');
      return true;
    },
    applications: () => db.collection.jobApplications
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((a) => {
        const job = db.collection.jobs.find((j) => j.id === a.jobId);
        const user = findUser(a.candidateId);
        return { ...a, jobTitle: job?.title || '—', candidateName: user?.displayName || '—' };
      }),
    shortlist(id) {
      const application = db.collection.jobApplications.find((x) => x.id === id && x.status === 'PENDING');
      if (!application) return null;
      application.status = 'SHORTLISTED';
      application.updatedAt = now();
      db.touch('jobApplications');
      return application;
    },
    forward(id) {
      const application = db.collection.jobApplications.find((x) => x.id === id && ['PENDING','SHORTLISTED'].includes(x.status));
      if (!application) return null;
      application.status = 'FORWARDED';
      application.updatedAt = now();
      db.touch('jobApplications');
      return application;
    },
    reject(id) {
      const application = db.collection.jobApplications.find((x) => x.id === id && ['PENDING','SHORTLISTED'].includes(x.status));
      if (!application) return null;
      application.status = 'REJECTED';
      application.updatedAt = now();
      db.touch('jobApplications');
      return application;
    },
    save: () => db.save(),
  });
}
