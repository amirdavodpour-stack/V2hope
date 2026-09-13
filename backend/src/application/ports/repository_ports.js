/**
 * Capability slices over the concrete repository facade.
 * Application services receive only the operations they need instead of the
 * whole persistence module. This keeps the dependency direction explicit and
 * makes later repository/DB replacement local to the composition root.
 */
const slice = (source, methods, name) => Object.freeze(Object.fromEntries(methods.map((method) => {
  if (typeof source?.[method] !== 'function') {
    throw new TypeError(`${name} port is missing ${method}()`);
  }
  return [method, source[method].bind(source)];
})));

export function createRepositoryPorts(repo) {
  if (!repo || typeof repo !== 'object') throw new TypeError('repository facade is required');
  return Object.freeze({
    jobs: slice(repo, ['listJobViews', 'insertJob', 'updateJobSimple', 'transitionJobWithPayment'], 'JobRepository'),
    applications: slice(repo, ['findJobApplication', 'insertJobApplication', 'transitionCandidateApplication'], 'ApplicationRepository'),
    payments: slice(repo, ['findPaymentByJob', 'fundJobAtomic', 'createRefundAtomic', 'enqueuePaymentRelease', 'applyPaymentWebhookAtomic', 'getAdminFinancialSummary'], 'PaymentRepository'),
    admin: slice(repo, [
      'getAdminSummary', 'listAdminUsers', 'listAdminJobs', 'listAdminApplications', 'listAdminAudit',
      'setUserStatus', 'moderateJob', 'deleteJob', 'listTrustReports', 'updateTrustReportStatus',
      'transitionJobApplication', 'selectJobApplication',
    ], 'AdminRepository'),
    marketplace: slice(repo, ['listJobViews', 'insertJob', 'updateJobSimple'], 'MarketplaceRepository'),
    categories: slice(repo, ['listCategories'], 'CategoryRepository'),
    privacy: slice(repo, ['getUserPrivacyBundle', 'listDeletableUserUploadKeys', 'deleteUserPrivacyBundle'], 'PrivacyRepository'),
  });
}
