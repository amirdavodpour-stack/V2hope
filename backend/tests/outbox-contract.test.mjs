import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repo = ['payment_funding.js','payment_refunds.js','payment_webhooks.js','outbox.js'].map((name) => fs.readFileSync(new URL(`../src/repository/${name}`, import.meta.url), 'utf8')).join('\n');
const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../src/outbox_worker.js', import.meta.url), 'utf8');
const handlers = fs.readFileSync(new URL('../src/outbox_handlers.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const paymentRoutes = fs.readFileSync(new URL('../src/routes/payment_routes.js', import.meta.url), 'utf8');

test('outbox worker uses bounded parallel consumers instead of a single global busy gate', () => {
  assert.match(worker, /outboxWorkerConcurrency/);
  assert.match(worker, /Array\.from\(\{ length: config\.outboxWorkerConcurrency \}/);
  assert.doesNotMatch(worker, /let busy = false/);
});

test('outbox schema is durable and retry-aware', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS outbox_events/);
  assert.match(schema, /status TEXT NOT NULL DEFAULT 'PENDING'/);
  assert.match(schema, /dedupe_key TEXT NULL UNIQUE/);
  assert.match(schema, /available_at TIMESTAMPTZ/);
  assert.match(schema, /attempts INTEGER NOT NULL DEFAULT 0/);
});


test('payment create-hold uses transactional outbox and never runs the provider from the request handler', () => {
  assert.match(repo, /INSERT INTO payments\(id,job_id,payer_id,payee_id,amount,status,provider_ref/);
  assert.match(repo, /'HOLD_PENDING'/);
  assert.match(repo, /PAYMENT_CREATE_HOLD/);
  assert.match(handlers, /event\.event_type === 'PAYMENT_CREATE_HOLD'/);
  assert.doesNotMatch(app, /paymentProvider\.createHold/);
});

test('create-hold completion is idempotent and terminal failures unlock an explicit retry path', () => {
  assert.match(repo, /completePaymentCreateHoldOutbox/);
  assert.match(repo, /payment\.status === 'HELD'/);
  assert.match(repo, /payment\.provider_ref !== providerRef/);
  assert.match(repo, /status='HOLD_FAILED'/);
  assert.match(repo, /status === 'HOLD_FAILED'/);
});
test('payment release is queued with a database uniqueness guard', () => {
  assert.match(repo, /export async function enqueuePaymentRelease/);
  assert.match(repo, /ON CONFLICT\(dedupe_key\)/);
  assert.match(repo, /SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /SELECT \* FROM payments WHERE id=\$1 AND job_id=\$2 FOR UPDATE/);
});

test('outbox claim uses SKIP LOCKED', () => {
  assert.match(repo, /FOR UPDATE SKIP LOCKED/);
  assert.match(repo, /status='PROCESSING'/);
});

test('failed outbox work is retried and eventually terminal', () => {
  assert.match(repo, /export async function failOutboxEvent/);
  assert.match(repo, /maxAttempts/);
  assert.match(repo, /terminal \? 'FAILED' : 'PENDING'/);
  assert.match(repo, /outboxRetryDelaySeconds/);
  assert.match(repo, /jitterFactor/);
  assert.match(repo, /Math\.min\(300/);
  assert.match(handlers, /failOutboxEvent/);
});

test('payment release completion is idempotent', () => {
  assert.match(repo, /if \(payment\.status === 'RELEASED'\)/);
  assert.match(repo, /status='DONE'/);
});

test('API preserves synchronous success but safely degrades to 202', () => {
  assert.match(paymentRoutes, /processPaymentReleaseNow/);
  assert.match(paymentRoutes, /sendJson\(res, 202/);
  assert.match(paymentRoutes, /settlement: \{ status:'PENDING'/);
});

test('release audit is committed with settlement transaction', () => {
  assert.match(repo, /INSERT INTO audit_logs\(id,action,actor_id,entity_type,entity_id,meta,created_at\)/);
  assert.match(repo, /PAYMENT_RELEASE/);
});
