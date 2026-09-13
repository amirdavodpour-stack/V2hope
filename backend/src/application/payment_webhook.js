import crypto from 'node:crypto';
import { applyLocalPaymentWebhookLegacy } from '../legacy/payment_webhook_legacy.js';
import { verifyTimestampedPayload } from '../webhook_security.js';

const PAYMENT_WEBHOOK_EVENTS = new Set(['PAYMENT_HELD', 'PAYMENT_RELEASED', 'PAYMENT_REFUNDED']);
const eventTypeRequiresProviderRef = (eventType) => ['PAYMENT_HELD', 'PAYMENT_RELEASED'].includes(String(eventType || '').trim().toUpperCase());

export function verifyPaymentWebhookSignature(raw, signature, secret, { timestamp, eventId, maxAgeSeconds = 300, requireTimestamp = true, nowMs = Date.now() } = {}) {
  if (!secret) return false;
  if (requireTimestamp) return verifyTimestampedPayload(raw, signature, secret, { timestamp, eventId, maxAgeSeconds, nowMs });
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
  const providedBuf = Buffer.from(String(signature || '').trim());
  const expectedBuf = Buffer.from(expected);
  return providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export function normalizePaymentWebhookBody(body, { requireFields, enumField }) {
  requireFields(body, ['eventId', 'eventType', 'paymentId']);
  const eventId = String(body.eventId || '').trim();
  const paymentId = String(body.paymentId || '').trim();
  const providerRef = String(body.providerRef || '').trim();
  if (!eventId || eventId.length > 200) throw new Error('INVALID_EVENT_ID');
  if (!paymentId || paymentId.length > 100) throw new Error('INVALID_PAYMENT_ID');
  if (eventTypeRequiresProviderRef(body.eventType) && !providerRef) throw new Error('INVALID_PROVIDER_REF');
  return {
    eventId,
    eventType: enumField(body.eventType, PAYMENT_WEBHOOK_EVENTS, 'eventType'),
    paymentId,
    providerRef,
    payload: body,
  };
}

export async function applyLocalPaymentWebhook(args) { return applyLocalPaymentWebhookLegacy(args); }
