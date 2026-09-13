import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyPaymentWebhookSignature, normalizePaymentWebhookBody } from '../src/application/payment_webhook.js';
import { signTimestampedPayload } from '../src/webhook_security.js';

const secret = 'webhook-test-secret';

test('webhook signature verification is exact and timing-safe compatible', () => {
  const raw = Buffer.from('{"eventId":"e1"}');
  const timestamp = 1700000000;
  const eventId = 'e1';
  const signature = signTimestampedPayload(raw, secret, timestamp, eventId);
  assert.equal(verifyPaymentWebhookSignature(raw, signature, secret, { timestamp, eventId, maxAgeSeconds: 300, nowMs: timestamp * 1000 }), true);
  assert.equal(verifyPaymentWebhookSignature(raw, signature.slice(0, -1), secret, { timestamp, eventId, maxAgeSeconds: 300, nowMs: timestamp * 1000 }), false);
  assert.equal(verifyPaymentWebhookSignature(raw, signature, 'wrong-secret', { timestamp, eventId, maxAgeSeconds: 300, nowMs: timestamp * 1000 }), false);
});

test('webhook normalizer validates event shape once at the application boundary', () => {
  const requireFields = (body, fields) => {
    for (const field of fields) assert.ok(body[field] != null, field);
  };
  const enumField = (value, allowed) => {
    const normalized = String(value).toUpperCase();
    assert.ok(allowed.has(normalized));
    return normalized;
  };
  const event = normalizePaymentWebhookBody({eventId: 7, eventType: 'payment_held', paymentId: 9, providerRef: 11}, {requireFields, enumField});
  assert.deepEqual(event, {eventId:'7', eventType:'PAYMENT_HELD', paymentId:'9', providerRef:'11', payload:{eventId:7,eventType:'payment_held',paymentId:9,providerRef:11}});
});
