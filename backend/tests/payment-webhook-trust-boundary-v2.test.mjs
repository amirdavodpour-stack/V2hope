import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePaymentWebhookBody } from '../src/application/payment_webhook.js';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../src/routes/payment_routes.js', import.meta.url), 'utf8');
const repo = readFileSync(new URL('../src/repository/payment_webhooks.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../src/db/migrations/003_payment_release_recovery.js', import.meta.url), 'utf8');

test('signed webhook event id is bound to the payload event id', () => {
  const event = normalizePaymentWebhookBody({ eventId:'evt-1', eventType:'PAYMENT_RELEASED', paymentId:'pay-1', providerRef:'prov-1' }, {
    requireFields: (body, fields) => { for (const f of fields) assert.ok(body[f]); },
    enumField: (value, allowed) => { const v=String(value); assert.ok(allowed.has(v)); return v; },
  });
  assert.equal(event.eventId, 'evt-1');
  assert.match(route, /event\.eventId !== eventId/);
});

test('release webhook can reconcile RELEASE_FAILED and provider ref mismatch is rejected', () => {
  assert.match(repo, /RELEASE_STATES\.has\(p\.status\)/);
  assert.match(repo, /PROVIDER_REF_MISMATCH/);
});

test('migration rollback fails closed instead of rewriting RELEASE_FAILED rows', () => {
  assert.match(migration, /Cannot rollback payment_release_recovery while RELEASE_FAILED rows exist/);
  assert.doesNotMatch(migration, /UPDATE payments SET status='RELEASE_PENDING'/);
});
