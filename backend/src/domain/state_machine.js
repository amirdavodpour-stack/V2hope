export class InvalidStateTransitionError extends Error {
  constructor(entity, from, to) {
    super(`${entity} cannot transition from ${from} to ${to}`);
    this.code = 'INVALID_STATE_TRANSITION';
    this.entity = entity;
    this.from = from;
    this.to = to;
  }
}

export function assertTransition({ entity, current, next, transitions }) {
  const allowed = transitions[current] || [];
  if (!allowed.includes(next)) throw new InvalidStateTransitionError(entity, current, next);
  return next;
}
