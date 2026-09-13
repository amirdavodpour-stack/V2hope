import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pubspecText = fs.readFileSync(path.join(projectRoot, 'pubspec.yaml'), 'utf8');
const hopeVersionMatch = pubspecText.match(/^version:\s*([^\r\n]+)/m);
export const HOPE_VERSION = hopeVersionMatch?.[1]?.trim()?.split('+', 1)?.[0] || 'unknown';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const positiveIntegerEnv = (name, fallback, { min = 1, max = 2147483647 } = {}) => {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
};

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: positiveIntegerEnv('PORT', 3000, { min: 1, max: 65535 }),
  dataFile: process.env.DATA_FILE || path.join(backendRoot, 'data', 'hope.json'),
  storageDir: process.env.STORAGE_DIR || path.join(backendRoot, 'storage'),
  accessSecret: process.env.ACCESS_TOKEN_SECRET || 'change-this-access-secret',
  refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'change-this-refresh-secret',
  accessTtlSeconds: positiveIntegerEnv('ACCESS_TOKEN_TTL', 900, { min: 60, max: 86400 }),
  accessIssuer: process.env.ACCESS_TOKEN_ISSUER || 'hope-api',
  accessAudience: process.env.ACCESS_TOKEN_AUDIENCE || 'hope-mobile',
  maxRequestBytes: positiveIntegerEnv('MAX_REQUEST_BYTES', 1024 * 1024, { min: 1024, max: 25 * 1024 * 1024 }),
  requestTimeoutMs: positiveIntegerEnv('REQUEST_TIMEOUT_MS', 30000, { min: 1000, max: 120000 }),
  headersTimeoutMs: positiveIntegerEnv('HEADERS_TIMEOUT_MS', 15000, { min: 1000, max: 120000 }),
  keepAliveTimeoutMs: positiveIntegerEnv('KEEP_ALIVE_TIMEOUT_MS', 5000, { min: 1000, max: 120000 }),
  refreshTtlSeconds: positiveIntegerEnv('REFRESH_TOKEN_TTL', 60 * 60 * 24 * 30, { min: 3600, max: 365 * 86400 }),
  maxUploadBytes: positiveIntegerEnv('MAX_UPLOAD_BYTES', 10 * 1024 * 1024, { min: 1024, max: 100 * 1024 * 1024 }),
  maxConcurrentUploads: positiveIntegerEnv('MAX_CONCURRENT_UPLOADS', 4, { min: 1, max: 64 }),
  databaseUrl: process.env.DATABASE_URL || '',
  pgPoolMax: positiveIntegerEnv('PG_POOL_MAX', 10, { min: 1, max: 100 }),
  rateLimitStore: process.env.RATE_LIMIT_STORE || (process.env.DATABASE_URL ? 'postgres' : 'memory'),
  rateLimitWindowMs: positiveIntegerEnv('RATE_LIMIT_WINDOW_MS', 60000, { min: 1000, max: 3600000 }),
  authRateLimitMax: positiveIntegerEnv('AUTH_RATE_LIMIT_MAX', 10, { min: 1, max: 1000 }),
  trustProxy: process.env.TRUST_PROXY === 'true',
  trustedProxyIps: String(process.env.TRUSTED_PROXY_IPS || '').split(',').map((v) => v.trim()).filter(Boolean),
  allowedCorsOrigins: String(process.env.ALLOWED_CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean),
  metricsToken: process.env.METRICS_TOKEN || '',
  generalRateLimitWindowMs: positiveIntegerEnv('GENERAL_RATE_LIMIT_WINDOW_MS', 60000, { min: 1000, max: 3600000 }),
  generalRateLimitMax: positiveIntegerEnv('GENERAL_RATE_LIMIT_MAX', 120, { min: 1, max: 10000 }),
  healthRateLimitWindowMs: positiveIntegerEnv('HEALTH_RATE_LIMIT_WINDOW_MS', 10000, { min: 1000, max: 3600000 }),
  healthRateLimitMax: positiveIntegerEnv('HEALTH_RATE_LIMIT_MAX', 120, { min: 1, max: 1000 }),
  resetTokenTtlSeconds: positiveIntegerEnv('RESET_TOKEN_TTL', 900, { min: 60, max: 86400 }),
  exposeResetTokenInDevelopment: process.env.EXPOSE_RESET_TOKEN_IN_DEVELOPMENT === 'true',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'simulator',
  paymentCurrency: process.env.PAYMENT_CURRENCY || 'USD',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
  paymentProviderToken: process.env.PAYMENT_PROVIDER_TOKEN || '',
  paymentProviderCreateUrl: process.env.PAYMENT_PROVIDER_CREATE_URL || '',
  paymentProviderReleaseUrl: process.env.PAYMENT_PROVIDER_RELEASE_URL || '',
  paymentProviderRefundUrl: process.env.PAYMENT_PROVIDER_REFUND_URL || '',
  paymentProviderTimeoutMs: positiveIntegerEnv('PAYMENT_PROVIDER_TIMEOUT_MS', 5000, { min: 500, max: 60000 }),
  paymentProviderMaxAttempts: positiveIntegerEnv('PAYMENT_PROVIDER_MAX_ATTEMPTS', 3, { min: 1, max: 5 }),
  paymentProviderRetryBaseMs: positiveIntegerEnv('PAYMENT_PROVIDER_RETRY_BASE_MS', 100, { min: 0, max: 10000 }),
  outboxPollMs: positiveIntegerEnv('OUTBOX_POLL_MS', 1000, { min: 100, max: 60000 }),
  outboxWorkerConcurrency: positiveIntegerEnv('OUTBOX_WORKER_CONCURRENCY', 4, { min: 1, max: 32 }),
  outboxMaxAttempts: positiveIntegerEnv('OUTBOX_MAX_ATTEMPTS', 8, { min: 1, max: 100 }),
  outboxLeaseSeconds: positiveIntegerEnv('OUTBOX_LEASE_SECONDS', 60, { min: 5, max: 3600 }),
  resetDeliveryMode: process.env.RESET_TOKEN_DELIVERY_MODE || 'console',
  resetDeliveryUrl: process.env.RESET_TOKEN_DELIVERY_URL || '',
  resetDeliveryTimeoutMs: positiveIntegerEnv('RESET_TOKEN_DELIVERY_TIMEOUT_MS', 5000, { min: 500, max: 60000 }),
  resetDeliverySecret: process.env.RESET_TOKEN_DELIVERY_SECRET || '',
  paymentWebhookMaxAgeSeconds: positiveIntegerEnv('PAYMENT_WEBHOOK_MAX_AGE_SECONDS', 300, { min: 30, max: 3600 }),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  storageBackend: process.env.STORAGE_BACKEND || 'local',
  s3Bucket: process.env.S3_BUCKET || '',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  s3Prefix: process.env.S3_PREFIX || 'uploads',
  s3ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION || 'AES256',
  uploadIntentTtlSeconds: positiveIntegerEnv('UPLOAD_INTENT_TTL_SECONDS', 300, { min: 30, max: 86400 }),
  notificationEmailUrl: process.env.NOTIFICATION_EMAIL_URL || '',
  notificationPushUrl: process.env.NOTIFICATION_PUSH_URL || '',
  notificationProviderToken: process.env.NOTIFICATION_PROVIDER_TOKEN || '',
  notificationMaxAttempts: positiveIntegerEnv('NOTIFICATION_MAX_ATTEMPTS', 3, { min: 1, max: 8 }),
  notificationRetryBaseMs: positiveIntegerEnv('NOTIFICATION_RETRY_BASE_MS', 100, { min: 0, max: 10000 }),
  notificationDeliveryTimeoutMs: positiveIntegerEnv('NOTIFICATION_DELIVERY_TIMEOUT_MS', 5000, { min: 500, max: 60000 }),
  maxIdempotencyKeyLength: positiveIntegerEnv('MAX_IDEMPOTENCY_KEY_LENGTH', 200, { min: 16, max: 1024 }),
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',
  alertWebhookToken: process.env.ALERT_WEBHOOK_TOKEN || '',
  alertWebhookTimeoutMs: positiveIntegerEnv('ALERT_WEBHOOK_TIMEOUT_MS', 3000, { min: 500, max: 30000 }),
};

if (process.env.NODE_ENV === 'production') {
  if (config.accessSecret.startsWith('change-this') || config.refreshSecret.startsWith('change-this')) {
    throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set in production');
  }
  if (!config.databaseUrl) throw new Error('DATABASE_URL must be set in production');
  if (config.rateLimitStore !== 'postgres') throw new Error('RATE_LIMIT_STORE=postgres is required in production');
  if (config.trustProxy && !config.trustedProxyIps.length) throw new Error('TRUSTED_PROXY_IPS must be set when TRUST_PROXY=true in production');
  if (!config.publicBaseUrl.startsWith('https://')) throw new Error('PUBLIC_BASE_URL must use HTTPS in production');
  if (config.accessSecret.length < 32 || config.refreshSecret.length < 32) throw new Error('Access and refresh secrets must be at least 32 characters in production');
  if (config.accessSecret === config.refreshSecret) throw new Error('Access and refresh secrets must be different in production');
  if (!config.metricsToken || config.metricsToken.length < 24) throw new Error('METRICS_TOKEN must be set and sufficiently long in production');
  if (config.alertWebhookUrl && !config.alertWebhookUrl.startsWith('https://')) throw new Error('ALERT_WEBHOOK_URL must use HTTPS in production when set');
  if (config.alertWebhookUrl && !config.alertWebhookToken) throw new Error('ALERT_WEBHOOK_TOKEN must be set when ALERT_WEBHOOK_URL is configured');
  if (!config.allowedCorsOrigins.length || config.allowedCorsOrigins.includes('*') || config.allowedCorsOrigins.some((origin) => origin.includes('*'))) throw new Error('ALLOWED_CORS_ORIGINS must explicitly list non-wildcard origins in production');
  for (const origin of config.allowedCorsOrigins) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('ALLOWED_CORS_ORIGINS must contain valid origins'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('ALLOWED_CORS_ORIGINS must contain origin URLs without credentials, paths, queries, or fragments');
    }
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      throw new Error('Non-local production CORS origins must use HTTPS');
    }
  }
  if (config.storageBackend !== 's3') throw new Error('STORAGE_BACKEND=s3 is required in production');
  if (!config.s3Bucket) throw new Error('S3_BUCKET must be set in production');
  if (config.s3Endpoint && !config.s3Endpoint.startsWith('https://')) throw new Error('S3_ENDPOINT must use HTTPS when set in production');
  if (!['AES256', 'aws:kms'].includes(config.s3ServerSideEncryption)) throw new Error('S3_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms');
  if (!['webhook'].includes(config.paymentProvider)) throw new Error('PAYMENT_PROVIDER=webhook is required in production');
  if (!config.paymentProviderToken || config.paymentProviderToken.length < 24) throw new Error('PAYMENT_PROVIDER_TOKEN must be set and sufficiently long in production');
  for (const [name, value] of Object.entries({ PAYMENT_PROVIDER_CREATE_URL: config.paymentProviderCreateUrl, PAYMENT_PROVIDER_RELEASE_URL: config.paymentProviderReleaseUrl, PAYMENT_PROVIDER_REFUND_URL: config.paymentProviderRefundUrl })) {
    if (!value.startsWith('https://')) throw new Error(`${name} must use HTTPS in production`);
  }
  if (!config.paymentWebhookSecret || config.paymentWebhookSecret.length < 24) throw new Error('PAYMENT_WEBHOOK_SECRET must be set and sufficiently long in production');
  if (config.notificationPushUrl && !config.notificationPushUrl.startsWith('https://')) throw new Error('NOTIFICATION_PUSH_URL must use HTTPS in production when set');
  if (config.notificationEmailUrl && !config.notificationEmailUrl.startsWith('https://')) throw new Error('NOTIFICATION_EMAIL_URL must use HTTPS in production when set');
  if ((config.notificationPushUrl || config.notificationEmailUrl) && (!config.notificationProviderToken || config.notificationProviderToken.length < 24)) {
    throw new Error('NOTIFICATION_PROVIDER_TOKEN must be set and sufficiently long when external notification delivery is configured');
  }
  if (config.resetDeliveryMode !== 'webhook') throw new Error('RESET_TOKEN_DELIVERY_MODE=webhook is required in production');
  if (!config.resetDeliveryUrl.startsWith('https://')) throw new Error('RESET_TOKEN_DELIVERY_URL must use HTTPS in production when webhook delivery is enabled');
  if (!config.resetDeliverySecret || config.resetDeliverySecret.length < 32) throw new Error('RESET_TOKEN_DELIVERY_SECRET must be at least 32 characters in production');
}
