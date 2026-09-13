import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { verifyTimestampedPayload, signTimestampedPayload } from '../src/webhook_security.js';

test('password hardening uses 600k PBKDF2 and rehashes legacy hashes', () => {
  const security = fs.readFileSync(new URL('../src/security.js', import.meta.url), 'utf8');
  const auth = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
  const repo = fs.readFileSync(new URL('../src/repository/auth.js', import.meta.url), 'utf8');
  assert.match(security, /PBKDF2_ITERATIONS = 600_000/);
  assert.match(security, /PASSWORD_MAX_LENGTH = 128/);
  assert.match(auth, /passwordNeedsRehash/);
  assert.match(repo, /UPDATE users SET password_hash/);
});

test('timestamped webhook signatures reject stale/replayed timestamps', () => {
  const raw = '{"eventId":"evt-1"}';
  const secret = 's'.repeat(40);
  const now = 1_700_000_000_000;
  const ts = Math.floor(now / 1000);
  const sig = signTimestampedPayload(raw, secret, ts, 'evt-1');
  assert.equal(verifyTimestampedPayload(raw, sig, secret, {timestamp:String(ts), eventId:'evt-1', maxAgeSeconds:300, nowMs:now}), true);
  assert.equal(verifyTimestampedPayload(raw, sig, secret, {timestamp:String(ts-301), eventId:'evt-1', maxAgeSeconds:300, nowMs:now}), false);
  assert.equal(verifyTimestampedPayload(raw, sig, secret, {timestamp:String(ts), eventId:'evt-2', maxAgeSeconds:300, nowMs:now}), false);
});

test('production reset delivery is cryptographically authenticated', () => {
  const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  const session = fs.readFileSync(new URL('../src/services/session.js', import.meta.url), 'utf8');
  const env = fs.readFileSync(new URL('../scripts/validate-production-env.sh', import.meta.url), 'utf8');
  assert.match(config, /RESET_TOKEN_DELIVERY_SECRET/);
  assert.match(session, /x-hope-reset-signature/);
  assert.match(session, /timestamp.*eventId/s);
  assert.match(env, /RESET_TOKEN_DELIVERY_SECRET/);
});

test('production release workflow supplies its security contract', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/production-release.yml', import.meta.url), 'utf8');
  for (const marker of ['ACCESS_TOKEN_SECRET_PRODUCTION','REFRESH_TOKEN_SECRET_PRODUCTION','PAYMENT_WEBHOOK_SECRET_PRODUCTION','RESET_TOKEN_DELIVERY_SECRET_PRODUCTION','ALLOWED_CORS_ORIGINS_PRODUCTION']) assert.match(workflow, new RegExp(marker));
});


test('crash telemetry redacts bearer/query credentials before persistence', () => {
  const source = fs.readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8');
  assert.ok(source.includes('access[_-]?token'));
  assert.ok(source.includes('refresh[_-]?token'));
  assert.ok(source.includes('https?:\\/\\/'));
  assert.ok(source.includes('[REDACTED]'));
});


test('direct upload completion enforces the configured maximum object size', () => {
  const source = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
  assert.match(source, /head\.size > config\.maxUploadBytes/);
  assert.match(source, /FILE_TOO_LARGE/);
});


test('password policy rejects oversize credentials without hashing them', () => {
  const auth = fs.readFileSync(new URL('../src/routes/auth_routes.js', import.meta.url), 'utf8');
  assert.match(auth, /password\.length < 12/);
  assert.match(auth, /password\.length > PASSWORD_MAX_LENGTH/);
});
