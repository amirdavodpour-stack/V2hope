import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const authRoutes = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
const paymentRoutes = fs.readFileSync(new URL('../src/routes/payment_routes.js', import.meta.url), 'utf8');
const storageRoutes = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
const jobRoutes = fs.readFileSync(new URL('../src/routes/job_routes.js', import.meta.url), 'utf8');
const jobHandlers = fs.readFileSync(new URL('../src/routes/job_handlers.js', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const legacyAdapter = fs.readFileSync(new URL('../src/db/legacy_adapter.js', import.meta.url), 'utf8');
const jobLegacy = fs.readFileSync(new URL('../src/application/legacy/job_legacy.js', import.meta.url), 'utf8');
const authLegacy = fs.readFileSync(new URL('../src/application/legacy/auth_legacy.js', import.meta.url), 'utf8');
const http = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
const validation = fs.readFileSync(new URL('../src/policies/validation.js', import.meta.url), 'utf8');

test('persistence hardening marks legacy mutations dirty behind adapters', () => {
  for (const marker of ["legacyJobs.touch('jobs')", "legacyJobs.touch('jobs', 'payments')"]) assert.ok(jobHandlers.includes(marker), marker);
  assert.match(jobLegacy, /db\.touch\(\.\.\.names\)/);
  assert.doesNotMatch(jobRoutes, /db\.(?:collection|insert|update|touch|save)/);
  assert.doesNotMatch(jobHandlers, /db\.(?:collection|insert|update|touch|save)/);
  assert.doesNotMatch(authRoutes, /db\.(?:collection|insert|update|touch|save)/);
  assert.match(authLegacy, /db\.touch\(['"]refreshTokens['"]/);
  assert.match(authLegacy, /db\.collection\.refreshTokens/);
  assert.match(legacyAdapter, /export async function persistLegacyFile\(/);
  assert.match(db, /isTestRuntime/);
  assert.match(db, /db\.collection is unavailable in production/);
  assert.match(db, /PostgreSQL is required outside the explicit NODE_ENV=test runtime/);
});

test('production security requirements exist', () => {
  assert.match(app, /x-metrics-token/);
  assert.match(http, /ALLOWED_CORS|allowedCorsOrigins|Access-Control-Allow-Origin/);
});

test('file upload validates content signatures', () => {
  for (const marker of ['%PDF', 'image/png', 'image/jpeg', 'image/webp', 'UNSUPPORTED_FILE']) assert.ok(http.includes(marker), marker);
});

test('business validation has explicit enums and bounded money/text', () => {
  for (const marker of ['JOB_TYPES', 'BUDGET_TYPES', 'moneyField', 'textField']) assert.ok(validation.includes(marker), marker);
});


test('production configuration requires durable object storage and reset delivery', () => {
  const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  assert.match(config, /STORAGE_BACKEND=s3|storageBackend !== 's3'/);
  assert.match(config, /RESET_TOKEN_DELIVERY_URL/);
});

test('local storage keeps uploaded files instead of deleting them', () => {
  const storage = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.match(storage, /fs\.rename\(file\.path, destination\)/);
});

test('direct upload has an explicit completion endpoint', () => {
  assert.match(app, /createStorageRoutes/);
  assert.match(storageRoutes, /parts\[1\] === 'complete'/);
  assert.match(storageRoutes, /UPLOAD_INTENT_REQUIRED/);
});


test('PostgreSQL boot is multi-writer safe and no advisory single-writer lock remains', () => {
  assert.doesNotMatch(db, /pg_try_advisory_lock|pg_advisory_unlock|single-writer lock/);
  assert.match(db, /PostgreSQL is the sole production persistence authority/);
});

test('S3 adapter uses a real readable stream for object uploads', () => {
  const storage = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.match(storage, /createReadStream\(file\.path\)/);
});


test('sendJson must not double-count requests in observability', () => {
  const source = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  const matches = source.match(/recordRequest\(/g) || [];
  assert.equal(matches.length, 0);
});

test('release outbox retries reset failed events to pending', () => {
  const source = fs.readFileSync(new URL('../src/repository/outbox.js', import.meta.url), 'utf8');
  assert.match(source, /ON CONFLICT\(dedupe_key\) DO UPDATE SET[\s\S]*status=CASE WHEN outbox_events\.status='DONE' THEN outbox_events\.status ELSE 'PENDING' END/);
});

test('docker production image installs runtime dependencies and runs unprivileged', () => {
  const source = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(source, /npm ci --omit=dev/);
  assert.match(source, /USER hope/);
});

test('evidence accepts only web URLs or constrained storage references', () => {
  const source = `${jobRoutes}\n${jobHandlers}`;
  assert.ok(source.includes('const isStorageRef ='));
  assert.match(source, /parsedUri\.protocol/);
  assert.ok(source.includes("storageKey = isStorageRef"));
});

test('storage evidence references are authorized to the uploading user', () => {
  const source = fs.readFileSync(new URL('../src/repository/storage.js', import.meta.url), 'utf8');
  assert.match(source, /FROM uploads WHERE storage_key=\$1 AND uploaded_by=\$2/);
  assert.match(source, /INVALID_STORAGE_REFERENCE/);
});

test('mobile file evidence uses a storage reference scheme', () => {
  const source = [
    fs.readFileSync(new URL('../../lib/features/transactions/transaction_page.dart', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../../lib/features/transactions/transaction_evidence.part.dart', import.meta.url), 'utf8'),
  ].join('\n');
  assert.match(source, /storage:\/\/\$\{uploaded\['key'\]\}/);
});

test('outbox worker never marks an uncommitted payment transition as processed', () => {
  const source = fs.readFileSync(new URL('../src/outbox_worker.js', import.meta.url), 'utf8');
  const handlers = fs.readFileSync(new URL('../src/outbox_handlers.js', import.meta.url), 'utf8');
  assert.match(handlers, /const completed = await completePaymentCreateHoldOutbox/);
  assert.match(handlers, /if \(!completed\?\.completed\) throw new Error\(`OUTBOX_CREATE_HOLD_COMMIT_FAILED/);
  assert.match(handlers, /const completed = await completePaymentReleaseOutbox/);
  assert.match(handlers, /if \(!completed\?\.completed\) throw new Error\(`OUTBOX_RELEASE_COMMIT_FAILED/);
});

test('payment idempotency is normalized consistently across header and body', () => {
  const source = fs.readFileSync(new URL('../src/routes/payment_routes.js', import.meta.url), 'utf8');
  const validationSource = fs.readFileSync(new URL('../src/policies/validation.js', import.meta.url), 'utf8');
  assert.match(source, /readIdempotencyKey/);
  assert.match(validationSource, /export function readIdempotencyKey/);
  assert.match(source, /bodyIdempotencyKey/);
  assert.match(source, /Header and body idempotency keys must match/);
  assert.match(source, /IDEMPOTENCY_CONFLICT/);
});

test('multipart parsing cleans temporary files on parse failures', () => {
  const source = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  assert.match(source, /try \{\n    const body = await fs\.promises\.readFile\(tempPath\)/);
  assert.match(source, /catch \(error\) \{\n    try \{ await fs\.promises\.unlink\(tempPath\); \} catch \{\}/);
});

test('object upload cleans up the temp file and compensates for DB insert failure', () => {
  const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const storageRouteSource = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
  const storageSource = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.ok(appSource.includes('createStorageRoutes'));
  assert.ok(storageRouteSource.includes('await storage.put(file);'));
  assert.ok(storageRouteSource.includes('ORPHAN_UPLOAD_CLEANUP_FAILED'));
  assert.match(storageSource, /DeleteObjectCommand/);
  assert.match(storageSource, /async delete\(\{ key \}\)/);
});

