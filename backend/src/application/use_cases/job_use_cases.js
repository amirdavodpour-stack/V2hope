import { requirePort } from '../ports/repositories.js';

export function createJobUseCases({ jobs }) {
  const repository = requirePort(jobs, 'jobs repository');
  return Object.freeze({
    list: (query) => repository.listJobViews(query),
    create: (draft) => repository.insertJob(draft),
    publish: (id, now) => repository.updateJobSimple(id, ['DRAFT'], { status: 'PUBLISHED', publishedAt: now, updatedAt: now }),
    start: (id, now) => repository.updateJobSimple(id, ['FUNDED'], { status: 'IN_PROGRESS', updatedAt: now }),
    deliver: (id, now) => repository.updateJobSimple(id, ['IN_PROGRESS'], { status: 'DELIVERED', updatedAt: now }),
    accept: (id, now) => repository.transitionJobWithPayment(id, ['DELIVERED', 'UNDER_REVIEW'], { status: 'COMPLETED', updatedAt: now }, 'HELD'),
  });
}
