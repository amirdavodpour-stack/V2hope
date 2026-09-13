import crypto from 'node:crypto';

export function signTimestampedPayload(raw, secret, timestamp, eventId = '') {
  const canonical = `${timestamp}.${eventId}.${raw}`;
  return `sha256=${crypto.createHmac('sha256', secret).update(canonical).digest('hex')}`;
}

export function verifyTimestampedPayload(raw, signature, secret, { timestamp, eventId = '', maxAgeSeconds = 300, nowMs = Date.now() } = {}) {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return false;
  const age = Math.abs(nowMs - ts * 1000);
  if (age > maxAgeSeconds * 1000) return false;
  const expected = signTimestampedPayload(raw, secret, ts, eventId);
  const provided = Buffer.from(String(signature).trim());
  const expectedBuf = Buffer.from(expected);
  return provided.length === expectedBuf.length && crypto.timingSafeEqual(provided, expectedBuf);
}
