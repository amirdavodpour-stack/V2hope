import { HttpError } from '../api/http_error.js';

export const JOB_TYPES = new Set(['FIXED', 'HOURLY', 'TASK']);
export const JOB_KINDS = new Set(['MISSION', 'JOB']);
export const JOB_VISIBILITY = new Set(['PUBLIC', 'SPECIALIZED']);
export const JOB_SCHEDULES = new Set(['PART_TIME', 'FULL_TIME']);
export const BUDGET_TYPES = new Set(['FIXED', 'RANGE']);

export function requireFields(body, names) {
  for (const name of names) {
    if (body?.[name] === undefined || body?.[name] === null || String(body[name]).trim() === '') {
      throw new HttpError(400, 'VALIDATION_ERROR', `${name} is required`);
    }
  }
}

// Use this at trust boundaries where coercing objects/arrays to strings would
// silently turn malformed JSON into valid credentials or identifiers.
export function stringField(value, field, { min = 1, max = 5000, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is required`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_FIELD', `${field} must be a string`);
  }
  const text = value.trim();
  if (required && !text) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is required`);
  if (text && (text.length < min || text.length > max)) {
    throw new HttpError(400, 'INVALID_FIELD', `${field} must be between ${min} and ${max} characters`);
  }
  return text;
}

export function textField(value, field, { min = 1, max = 5000, required = false } = {}) {
  return stringField(value, field, { min, max, required });
}

export function moneyField(value, field) {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw)) {
    throw new HttpError(400, 'INVALID_AMOUNT', `${field} must be a positive amount with at most 2 decimal places`);
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new HttpError(400, 'INVALID_AMOUNT', `${field} must be between 0 and 1000000000`);
  }
  return amount;
}

export function dateOnlyField(value, field) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpError(400, 'INVALID_DEADLINE', `${field} must use YYYY-MM-DD`);
  }
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HttpError(400, 'INVALID_DEADLINE', `${field} is invalid`);
  }
  return raw;
}

export function enumField(value, allowed, field) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!allowed.has(normalized)) throw new HttpError(400, 'INVALID_FIELD', `${field} is invalid`);
  return normalized;
}

export function requireAdmin(user) {
  if (user?.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', 'Admin access required');
  return user;
}

export function readIdempotencyKey(req, maxLength) {
  const raw = String(req.headers['idempotency-key'] || '').trim();
  if (!raw) return '';
  if (raw.length > maxLength) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key is too long');
  if (!/^[A-Za-z0-9._~:-]+$/.test(raw)) {
    throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key contains unsupported characters');
  }
  return raw;
}
