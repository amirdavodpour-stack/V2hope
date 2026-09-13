import { requirePort } from '../ports/repositories.js';

export function createApplicationUseCases({ applications }) {
  const repository = requirePort(applications, 'applications repository');
  return Object.freeze({
    find: (jobId, candidateId) => repository.findJobApplication(jobId, candidateId),
    create: (draft) => repository.insertJobApplication(draft),
    withdraw: (id, candidateId) => repository.transitionCandidateApplication(id, candidateId, ['PENDING', 'SHORTLISTED', 'FORWARDED', 'INTERVIEW'], 'WITHDRAWN'),
  });
}
