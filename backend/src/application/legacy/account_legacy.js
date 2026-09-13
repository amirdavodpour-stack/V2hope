/**
 * Explicit test-runtime adapter for account privacy operations.
 * Production account routes must use the PostgreSQL repository port instead.
 */
export function createAccountLegacyAdapter({ db, findUser, now }) {
  return Object.freeze({
    async getPrivacyBundle(userId) {
      return {
        user: findUser(userId),
        provider: db.collection.providers.find((x) => x.userId === userId) || null,
        jobs: db.collection.jobs.filter((x) => x.ownerId === userId || x.providerId === userId),
        evidence: db.collection.evidence.filter((x) => x.submittedBy === userId),
        uploads: db.collection.uploads.filter((x) => x.uploadedBy === userId),
        applications: db.collection.jobApplications.filter((x) => x.candidateId === userId),
        offers: db.collection.offers.filter((x) => x.providerId === userId),
        payments: db.collection.payments.filter((x) => x.payerId === userId || x.payeeId === userId),
        notifications: db.collection.notifications.filter((x) => x.userId === userId),
        preferences: db.collection.notificationPreferences.find((x) => x.userId === userId) || null,
        analyticsEvents: db.collection.analyticsEvents.filter((x) => x.userId === userId),
        crashReports: db.collection.crashReports.filter((x) => x.userId === userId),
        trustReports: db.collection.trustReports.filter((x) => x.reporterId === userId),
      };
    },

    async listDeletableUserUploadKeys(userId) {
      return db.collection.uploads
        .filter((upload) => upload.uploadedBy === userId)
        .filter((upload) => !db.collection.evidence.some((evidence) => evidence.uri === `storage://${upload.storageKey}`))
        .map((upload) => upload.storageKey);
    },

    async deleteUserPrivacyBundle(userId, replacement) {
      const deletedAt = now();
      db.collection.evidence.forEach((x) => { if (x.submittedBy === userId) x.submittedBy = null; });
      db.collection.uploads.forEach((x) => { if (x.uploadedBy === userId) x.uploadedBy = null; });
      db.collection.refreshTokens = db.collection.refreshTokens.filter((x) => x.userId !== userId);
      db.collection.resetTokens = db.collection.resetTokens.filter((x) => x.userId !== userId);
      db.collection.notificationDevices = db.collection.notificationDevices.filter((x) => x.userId !== userId);
      db.collection.notificationPreferences = db.collection.notificationPreferences.filter((x) => x.userId !== userId);
      db.collection.notifications = db.collection.notifications.filter((x) => x.userId !== userId);
      db.collection.analyticsEvents = db.collection.analyticsEvents.filter((x) => x.userId !== userId);
      db.collection.crashReports = db.collection.crashReports.filter((x) => x.userId !== userId);
      const user = findUser(userId);
      if (user) Object.assign(user, {
        email: replacement.email,
        passwordHash: replacement.passwordHash,
        displayName: 'Deleted user',
        status: 'DELETED',
        sessionVersion: Number(user.sessionVersion || 0) + 1,
        deletedAt,
      });
      for (const job of db.collection.jobs) {
        if (job.providerId === userId && ['DRAFT', 'PUBLISHED'].includes(job.status)) job.providerId = null;
      }
      db.touch('refreshTokens', 'resetTokens', 'notificationDevices', 'notificationPreferences', 'notifications', 'analyticsEvents', 'crashReports', 'users', 'jobs');
      await db.save();
      return true;
    },
  });
}
