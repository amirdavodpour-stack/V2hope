/** Legacy-only composition adapter. No production route/application code should
 * access the persistence facade directly; test-only file-mode reads/mutations
 * live here behind explicit functions.
 */
export function createAppLegacyAdapter({ db }) {
  const categories = () => db.collection.categories;
  const users = () => db.collection.users;
  const jobs = () => db.collection.jobs;
  const jobApplications = () => db.collection.jobApplications;
  const providers = () => db.collection.providers;
  const offers = () => db.collection.offers;

  const findCategoryById = (id) => categories().find((c) => c.id === id);
  const findJobById = (id) => jobs().find((j) => j.id === id);
  const findUserById = (id) => users().find((u) => u.id === id);
  const findApplicationById = (id) => jobApplications().find((a) => a.id === id);
  const findApplicationsByCandidate = (userId) => jobApplications().filter((a) => a.candidateId === userId);
  const findProvidersForView = () => providers();
  const findOffersForView = () => offers();

  const insertProvider = (value) => db.insert('providers', value);
  const id = () => db.id();
  const insertAudit = (audit) => db.insert('audit', audit);

  return {
    categories, users, jobs, jobApplications, providers, offers,
    findCategoryById, findJobById, findUserById, findApplicationById,
    findApplicationsByCandidate, findProvidersForView, findOffersForView,
    insertProvider, insertAudit, id,
  };
}
