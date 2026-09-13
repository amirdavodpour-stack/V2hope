/**
 * Transport-neutral application error contract.
 * HTTP adapters may map these fields to status codes and JSON envelopes,
 * while application/services/policies stay independent of the HTTP module.
 */
export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
