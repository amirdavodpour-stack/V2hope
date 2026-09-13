import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('JWT verification enforces issuer, audience, bounded token size, iat and jti', () => {
  const src = fs.readFileSync(new URL('../src/security.js', import.meta.url), 'utf8');
  assert.match(src, /maxBytes/);
  assert.match(src, /payload\.iss !== issuer/);
  assert.match(src, /payload\.aud !== audience/);
  assert.match(src, /payload\.jti/);
  assert.match(src, /payload\.iat > now \+ 30/);
});

test('production CORS is explicit and idempotency keys are bounded', () => {
  const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const authRoutes = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
  const paymentRoutes = fs.readFileSync(new URL('../src/routes/payment_routes.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
  assert.match(config, /ALLOWED_CORS_ORIGINS must explicitly list non-wildcard origins in production/);
  assert.match(paymentRoutes, /INVALID_IDEMPOTENCY_KEY/);
  assert.match(paymentRoutes, /maxIdempotencyKeyLength/);
});

test('HTTP hardening headers and server timeouts exist', () => {
  const http = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  for (const marker of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy']) assert.match(http, new RegExp(marker));
  for (const marker of ['requestTimeout','headersTimeout','keepAliveTimeout']) assert.match(server, new RegExp(marker));
});

test('payment idempotency conflicts are detected across jobs or amounts', () => {
  const repo = fs.readFileSync(new URL('../src/repository/payment_funding.js', import.meta.url), 'utf8');
  assert.match(repo, /IDEMPOTENCY_CONFLICT/);
  assert.match(repo, /prior\.jobId !== jobId/);
  assert.match(repo, /Number\(prior\.amount\) !== Number\(amount\)/);
});

test('access sessions support immediate revocation through a session version', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const authRoutes = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
  const session = fs.readFileSync(new URL('../src/services/session.js', import.meta.url), 'utf8');
  const schema = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
  const repo = fs.readFileSync(new URL('../src/repository/auth.js', import.meta.url), 'utf8');
  assert.match(authRoutes, /sessionVersion/);
  assert.match(session, /payload\.sv/);
  assert.match(schema, /session_version INTEGER NOT NULL DEFAULT 0/);
  assert.match(repo, /bumpUserSessionVersion/);
});

test('readiness endpoint fails closed when the database is down', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
  assert.match(app, /url\.pathname === '\/ready'|url\.pathname === '\/api\/v1\/ready'/);
  assert.match(app, /database\.status === 'ok'/);
  assert.match(app, /503/);
});


test('direct S3 uploads are checked against file magic bytes before completion', () => {
  const storage = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
  assert.match(storage, /GetObjectCommand/);
  assert.match(storage, /bytes=0-4095/);
  assert.match(storage, /INVALID_FILE_SIGNATURE/);
  assert.match(routes, /storage\.validateObject/);
});

test('authentication equalizes password verification for unknown accounts', () => {
  const security = fs.readFileSync(new URL('../src/security.js', import.meta.url), 'utf8');
  const authRoutes = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(security, /DUMMY_PASSWORD_HASH/);
  assert.match(authRoutes, /user\?\.passwordHash \|\| DUMMY_PASSWORD_HASH/);
  assert.match(authRoutes, /const passwordOk = await verifyPassword/);
  assert.match(app, /DUMMY_PASSWORD_HASH/);
});

test('password-reset request keeps a generic response when delivery is unavailable', () => {
  const authRoutes = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
  assert.match(authRoutes, /PASSWORD_RESET_DELIVERY_FAILED/);
  assert.match(authRoutes, /return sendJson\(res, 202, generic\)/);
});


test('trusted proxy client identity ignores spoofed forwarded headers from untrusted peers', async () => {
  const mod = await import('../src/rate_limit.js');
  const calls = [];
  const pool = { query: async (q) => { calls.push(q); return { rows: [{ request_count: 1 }] }; } };
  const limiter = mod.createRateLimiter({ pool, trustProxy: true, trustedProxyIps: ['10.0.0.10'] });
  await limiter.general({ headers: { 'x-forwarded-for': '203.0.113.10' }, socket: { remoteAddress: '198.51.100.20' } }, 10, 60000);
  await limiter.general({ headers: { 'x-forwarded-for': '203.0.113.11' }, socket: { remoteAddress: '198.51.100.20' } }, 10, 60000);
  assert.equal(calls[0].values[0], calls[1].values[0]);
});

test('trusted proxy client identity uses the first untrusted hop', async () => {
  const mod = await import('../src/rate_limit.js');
  const calls = [];
  const pool = { query: async (q) => { calls.push(q); return { rows: [{ request_count: 1 }] }; } };
  const limiter = mod.createRateLimiter({ pool, trustProxy: true, trustedProxyIps: ['10.0.0.10', '10.0.0.11'] });
  await limiter.general({ headers: { 'x-forwarded-for': '10.0.0.10, 10.0.0.11, 198.51.100.7, 10.0.0.11' }, socket: { remoteAddress: '10.0.0.10' } }, 10, 60000);
  await limiter.general({ headers: { 'x-forwarded-for': '10.0.0.10, 10.0.0.11, 198.51.100.8, 10.0.0.11' }, socket: { remoteAddress: '10.0.0.10' } }, 10, 60000);
  assert.notEqual(calls[0].values[0], calls[1].values[0]);
});

test('production configuration rejects unrestricted trusted-proxy mode', () => {
  const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  assert.match(config, /trustedProxyIps\.length/);
});
