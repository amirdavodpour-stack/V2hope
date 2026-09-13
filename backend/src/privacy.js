import crypto from 'node:crypto';

export const PRIVACY_VERSION = '1.2';

const exportSensitiveKeys = new Set(['passwordHash','providerRef','idempotencyKey','dedupeKey','authorization','token','accessToken','refreshToken','cvv','cardNumber','iban']);

function sanitizeExportObject(value, depth = 0) {
  if (depth > 4 || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 500).map(v => sanitizeExportObject(v, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (exportSensitiveKeys.has(String(key))) continue;
    if ((key === 'stack' || key === 'message' || key === 'details' || key === 'notes') && typeof val === 'string') {
      out[key] = val.slice(0, 4000);
    } else {
      out[key] = sanitizeExportObject(val, depth + 1);
    }
  }
  return out;
}


const sensitiveKeys = new Set(['email','phone','mobile','name','displayName','fullName','address','lat','lng','location','resume','resumeText','token','accessToken','refreshToken','password','passwordHash','authorization']);

export function sanitizeTelemetryProperties(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (sensitiveKeys.has(String(key))) continue;
    if (typeof value === 'string' && value.length > 200) out[key] = value.slice(0, 200);
    else if (typeof value === 'number' || typeof value === 'boolean' || value == null || typeof value === 'string') out[key] = value;
  }
  return out;
}

export function anonymizedEmail(userId) { return `deleted+${String(userId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0,32)}@invalid.local`; }
export function deletionCredential() { return crypto.randomBytes(48).toString('hex'); }

export function buildDataExport({ user, provider, jobs = [], applications = [], offers = [], payments = [], notifications = [], evidence = [], uploads = [], preferences = null, analyticsEvents = [], crashReports = [], trustReports = [] }) {
  const safeAccount = sanitizeExportObject({
    id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status, createdAt: user.createdAt,
  });
  return {
    exportVersion: PRIVACY_VERSION,
    generatedAt: new Date().toISOString(),
    account: safeAccount,
    provider: sanitizeExportObject(provider || null),
    jobs: sanitizeExportObject(jobs),
    applications: sanitizeExportObject(applications),
    offers: sanitizeExportObject(offers),
    payments: sanitizeExportObject(payments),
    notifications: sanitizeExportObject(notifications),
    evidence: sanitizeExportObject(evidence),
    analyticsEvents: sanitizeExportObject(analyticsEvents),
    crashReports: sanitizeExportObject(crashReports),
    trustReports: sanitizeExportObject(trustReports),
    uploads: sanitizeExportObject(uploads),
    notificationPreferences: sanitizeExportObject(preferences),
  };
}
