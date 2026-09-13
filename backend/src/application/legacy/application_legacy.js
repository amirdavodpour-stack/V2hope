/** Explicit test-runtime adapter for application persistence. */
export function createApplicationLegacyAdapter({ db, id, now }) {
  return Object.freeze({
    find(jobId, candidateId) {
      return db.collection.jobApplications.find((a) => a.jobId === jobId && a.candidateId === candidateId && ['PENDING', 'SELECTED'].includes(a.status)) || null;
    },
    withdraw(idValue, candidateId) {
      const a = db.collection.jobApplications.find((x) => x.id === idValue && x.candidateId === candidateId && ['PENDING','SHORTLISTED','FORWARDED','INTERVIEW'].includes(x.status));
      if (!a) return null;
      a.status = 'WITHDRAWN'; a.updatedAt = now(); db.touch('jobApplications');
      return a;
    },
    listForCandidate(candidateId) {
      return db.collection.jobApplications.filter((a) => a.candidateId === candidateId).map((a) => {
        const j = db.collection.jobs.find((x) => x.id === a.jobId);
        return {...a, jobTitle:j?.title || '—', jobCity:j?.city || null, jobKind:j?.kind || 'JOB'};
      });
    },
    create(draft) { return db.insert('jobApplications', draft); },
    newId() { return id(); },
    async save() { await db.save(); },
  });
}
