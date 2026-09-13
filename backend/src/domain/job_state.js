import { assertTransition } from './state_machine.js';

export const JOB_TRANSITIONS = Object.freeze({
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['FUNDED', 'PUBLISHED', 'CANCELLED'],
  FUNDED: ['IN_PROGRESS', 'PUBLISHED'],
  IN_PROGRESS: ['DELIVERED'],
  DELIVERED: ['UNDER_REVIEW', 'COMPLETED'],
  UNDER_REVIEW: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  SETTLED: [],
});

export function assertJobTransition(current, next) {
  return assertTransition({ entity: 'JOB', current, next, transitions: JOB_TRANSITIONS });
}
