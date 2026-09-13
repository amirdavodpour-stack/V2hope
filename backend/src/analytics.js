import crypto from 'node:crypto';
import { recordAnalyticsEventLegacy, recordCrashLegacy, localProductFunnelSummaryLegacy } from './legacy/analytics_legacy.js';
import * as repo from './repository.js';

const EVENT_RE = /^[A-Za-z][A-Za-z0-9_.:-]{1,63}$/;
const PLATFORM = new Set(['ANDROID','IOS','WEB','UNKNOWN']);
const MAX_PROPERTIES = 40;
const MAX_STRING = 256;
const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|email|phone|address|resume|document|national|iban|card|cvv/i;

function redactText(value) {
  return String(value || '').slice(0, 12000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:token|secret|password|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization)=([^&\s]+)/gi, (match) => match.slice(0, match.indexOf('=')) + '=[REDACTED]')
    .replace(/([?&](?:token|secret|password|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization)=)[^&\s]*/gi, '$1[REDACTED]')
    .replace(/https?:\/\/[^\s?#]+\?[^\s#]*/gi, (url) => url.replace(/([?&](?:token|secret|password|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization)=)[^&]*/gi, '$1[REDACTED]'));
}

function cleanValue(value, depth = 0) {
  if (depth > 3) return null;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (Array.isArray(value)) return value.slice(0, 20).map(v => cleanValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value).slice(0, MAX_PROPERTIES)) {
      if (!SENSITIVE.test(key)) out[String(key).slice(0, 64)] = cleanValue(val, depth + 1);
    }
    return out;
  }
  return null;
}

export function anonymousId(raw) {
  const value = String(raw || '').trim();
  return value ? crypto.createHash('sha256').update(value).digest('hex').slice(0, 32) : null;
}

export function normalizeEvent(input, userId = null) {
  const eventName = String(input?.eventName || '').trim();
  if (!EVENT_RE.test(eventName)) { const e = new Error('Invalid eventName'); e.code = 'INVALID_EVENT'; throw e; }
  const platform = String(input?.platform || 'UNKNOWN').trim().toUpperCase();
  if (!PLATFORM.has(platform)) { const e = new Error('Invalid platform'); e.code = 'INVALID_EVENT'; throw e; }
  const occurredAt = new Date(input?.occurredAt || Date.now());
  if (Number.isNaN(occurredAt.getTime())) { const e = new Error('Invalid occurredAt'); e.code = 'INVALID_EVENT'; throw e; }
  return {
    id: crypto.randomUUID(), eventName, userId: userId || null,
    anonymousId: anonymousId(input?.anonymousId), sessionId: String(input?.sessionId || '').slice(0, 128) || null,
    appVersion: String(input?.appVersion || '').slice(0, 64) || null, platform,
    properties: cleanValue(input?.properties || {}), occurredAt: occurredAt.toISOString(), createdAt: new Date().toISOString(),
  };
}

export async function recordAnalyticsEvent(input, userId = null, dedupeKey = '') {
  const event = normalizeEvent(input, userId);
  if (process.env.DATABASE_URL) return repo.insertAnalyticsEvent(event, dedupeKey);
  return recordAnalyticsEventLegacy(event, dedupeKey);
}

export function normalizeCrash(input, userId = null) {
  const message = String(input?.message || '').trim();
  if (!message || message.length > 2000) { const e = new Error('Invalid crash message'); e.code = 'INVALID_CRASH'; throw e; }
  const fingerprint = String(input?.fingerprint || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(fingerprint)) { const e = new Error('Invalid crash fingerprint'); e.code = 'INVALID_CRASH'; throw e; }
  const platform = String(input?.platform || 'UNKNOWN').trim().toUpperCase();
  if (!PLATFORM.has(platform)) { const e = new Error('Invalid platform'); e.code = 'INVALID_CRASH'; throw e; }
  const occurred = new Date(input?.occurredAt || Date.now());
  if (Number.isNaN(occurred.getTime())) { const e = new Error('Invalid occurredAt'); e.code = 'INVALID_CRASH'; throw e; }
  return { id: crypto.randomUUID(), userId: userId || null, anonymousId: anonymousId(input?.anonymousId), appVersion:String(input?.appVersion || '').slice(0,64)||null, platform, releaseChannel:String(input?.releaseChannel || '').slice(0,32)||null, fingerprint, message: redactText(message).slice(0,2000), stack:redactText(input?.stack || '')||null, context:cleanValue(input?.context||{}), occurredAt:occurred.toISOString(), createdAt:new Date().toISOString() };
}

export async function recordCrash(input, userId = null) {
  const crash = normalizeCrash(input, userId);
  if (process.env.DATABASE_URL) return repo.insertCrashReport(crash);
  return recordCrashLegacy(crash);
}


export const localProductFunnelSummary = localProductFunnelSummaryLegacy;
