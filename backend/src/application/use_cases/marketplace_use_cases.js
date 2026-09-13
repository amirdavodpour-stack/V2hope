import { requirePort } from '../ports/repositories.js';

export function createMarketplaceUseCases({ marketplaceRepository, categoryRepository = marketplaceRepository }) {
  const marketplace = requirePort(marketplaceRepository, 'marketplaceRepository');
  const categories = requirePort(categoryRepository, 'categoryRepository');
  return Object.freeze({
    listCategories: () => categories.listCategories(),
    listOpportunities: (query) => marketplace.listJobViews(query),
    createOpportunity: (draft) => marketplace.insertJob(draft),
    publishOpportunity: (jobId, actorId) => marketplace.updateJobSimple(jobId, ['DRAFT'], { status: 'PUBLISHED', publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), actorId }),
  });
}
