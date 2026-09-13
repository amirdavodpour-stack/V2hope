/**
 * Transport-neutral request context. Controllers/routes receive this object and
 * downstream application services should not depend on Node's IncomingMessage.
 */
export function createRequestContext({ requestId, traceId, principal = null, method, path }) {
  return Object.freeze({ requestId: String(requestId || ''), traceId: String(traceId || ''), principal, method, path });
}

export function principalFromUser(user) {
  if (!user) return null;
  return Object.freeze({ id: String(user.id), role: String(user.role || 'USER'), status: String(user.status || 'ACTIVE') });
}
