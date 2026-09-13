/** Stable API error envelope shared by controllers and future BFF/gateway layers. */
export function toErrorEnvelope(error, { requestId = null } = {}) {
  return {
    error: {
      code: String(error?.code || 'INTERNAL_ERROR'),
      message: String(error?.message || 'Request failed'),
      ...(error?.details ? { details: error.details } : {}),
      ...(requestId ? { requestId: String(requestId) } : {}),
    },
  };
}
