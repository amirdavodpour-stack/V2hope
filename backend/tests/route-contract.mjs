import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import fs from 'node:fs';

test('HOPE API exposes the mobile contract routes in source', async () => {
  const source = (await Promise.all([
    'app.js',
    'routes/auth_routes.js',
    'routes/storage_routes.js',
    'routes/job_routes.js',
    'routes/job_handlers.js',
    'routes/offer_routes.js',
    'routes/application_routes.js',
    'routes/payment_routes.js',
    'routes/provider_routes.js',
  ].map((file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n');
  for (const marker of [
    "route === 'register'", "route === 'login'", "route === 'refresh'",
    "route === 'logout'", "req.method === 'POST' && parts.length === 1",
    "parts[2] === 'publish'", "parts[2] === 'start'", "parts[2] === 'deliver'",
    "parts[2] === 'accept'", "parts[2] === 'evidence'",
    "parts[2] === 'offers'", "parts[2] === 'accept'",
    "parts[1] === 'fund'", "parts[1] === 'release'",
    "parts[1] === 'upload'", "parts[1] !== 'me'",
  ]) assert.ok(source.includes(marker), `Missing route marker: ${marker}`);
});


test('health endpoint reports database state and request handler flushes persistence', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(source.includes("databaseHealth"));
  assert.ok(source.includes("await db.flush()"));
  assert.ok(source.includes("/health"));
  assert.ok(source.includes("/ready"));
});

test('critical money and lifecycle paths keep ownership + payment-state guards', async () => {
  const source = (await Promise.all([
    'app.js', 'routes/payment_routes.js', 'routes/job_routes.js'
  ].map((file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n');
  for (const marker of [
    'Only the owner can fund a job',
    'Only the owner can release payment',
    'PAYMENT_REQUIRED',
    'INVALID_PAYMENT_STATE',
    'idempotencyKey',
    'enforceJobState',
  ]) assert.ok(source.includes(marker), `Missing safety marker: ${marker}`);
});


test('financial routes expose refund, financials and signed webhook contracts', async () => {
  const app = (await Promise.all([
    'app.js', 'routes/payment_routes.js'
  ].map((file) => fs.promises.readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n');
  assert.match(app, /parts\[1\] === 'refund'/);
  assert.match(app, /parts\[1\] === 'financials'/);
  assert.match(app, /parts\[1\] === 'webhook'/);
  assert.match(app, /INVALID_WEBHOOK_SIGNATURE/);
});

test('recommendation route exposes explainable scoring and coordinate safety', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /parts\[0\] === 'jobs' && parts\[1\] === 'recommended'/);
  assert.match(source, /function recommendationScore/);
  assert.match(source, /recommendationReasons/);
  assert.match(source, /INVALID_COORDINATE/);
});
