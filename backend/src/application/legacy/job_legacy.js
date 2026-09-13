/** Explicit test-only job adapter over the legacy in-memory DB facade. */
export function createJobLegacyAdapter({ db, categoryBy, relatedJob, findUser, publicUser, now }) {
  return Object.freeze({
    list({ status, user, kindFilter, visibilityFilter, cityFilter, categoryFilter, searchQuery }) {
      return db.collection.jobs
        .filter((j) => {
          if (j.status !== status) return false;
          if (status !== 'PUBLISHED' && !(user?.id === j.ownerId || user?.id === j.providerId)) return false;
          if (kindFilter && (j.kind || (j.jobType === 'FIXED' ? 'MISSION' : 'JOB')) !== kindFilter) return false;
          if (visibilityFilter && (j.visibility || 'PUBLIC') !== visibilityFilter) return false;
          if (cityFilter && (j.city || '') !== cityFilter) return false;
          if (categoryFilter && String(j.categoryId) !== categoryFilter && categoryBy(categoryFilter)?.id !== j.categoryId) return false;
          if (searchQuery) {
            const haystack = [j.title, j.description, j.city, categoryBy(j.categoryId)?.name, categoryBy(j.categoryId)?.nameEn]
              .map((x) => String(x || '')).join(' ').toLowerCase();
            if (!haystack.includes(searchQuery.toLowerCase())) return false;
          }
          return true;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    listMine(userId) {
      return db.collection.jobs.filter((j) => relatedJob(userId, j)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    findPaymentByJob(jobId) {
      return db.collection.payments.find((p) => p.jobId === jobId) || null;
    },
    createJob(draft) {
      return db.insert('jobs', draft);
    },
    save() {
      return db.save();
    },
    touch(...names) {
      return db.touch(...names);
    },
    listUploadsForUser(userId, storageKey) {
      return db.collection.uploads.some((u) => u.storageKey === storageKey && u.uploadedBy === userId);
    },
    insertEvidence(draft) {
      return db.insert('evidence', draft);
    },
    listCandidates(jobId, applicationIds) {
      return applicationIds
        .map((id) => db.collection.jobApplications.find((a) => a.id === id && a.jobId === jobId && ['FORWARDED', 'INTERVIEW', 'OFFERED', 'ACCEPTED'].includes(a.status)))
        .filter(Boolean);
    },
    selectedCandidates(jobId) {
      return db.collection.jobApplications
        .filter((a) => a.jobId === jobId && ['FORWARDED', 'INTERVIEW', 'OFFERED', 'ACCEPTED'].includes(a.status))
        .map((a) => ({ id: a.id, resumeText: a.resumeText, skills: a.skills, status: a.status, createdAt: a.createdAt, updatedAt: a.updatedAt, candidateId: a.candidateId }));
    },
    findApplication(id) {
      return db.collection.jobApplications.find((x) => x.id === id) || null;
    },
    hasAcceptedApplication(jobId, exceptId) {
      return db.collection.jobApplications.some((x) => x.jobId === jobId && x.status === 'ACCEPTED' && x.id !== exceptId);
    },
    insertTrustReport(report) {
      return db.insert('trustReports', report);
    },
    listOffers(jobId) {
      return db.collection.offers
        .filter((o) => o.jobId === jobId)
        .map((o) => ({ ...o, provider: publicUser(findUser(o.providerId)) }));
    },
  });
}
