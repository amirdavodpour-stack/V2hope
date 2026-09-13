import crypto from 'node:crypto';

const HEX_32 = /^[0-9a-f]{32}$/;
const HEX_16 = /^[0-9a-f]{16}$/;

export function traceContext(req) {
  const header = String(req.headers['traceparent'] || '').trim().toLowerCase();
  const match = /^(\w{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(header);
  if (match && match[1] === '00' && HEX_32.test(match[2]) && HEX_16.test(match[3]) && match[2] !== '0'.repeat(32) && match[3] !== '0'.repeat(16)) {
    return { traceId: match[2], parentId: match[3], flags: match[4] };
  }
  return { traceId: crypto.randomBytes(16).toString('hex'), parentId: null, flags: '01' };
}

export function makeTraceparent(ctx, spanId = crypto.randomBytes(8).toString('hex')) {
  return `00-${ctx.traceId}-${spanId}-${ctx.flags || '01'}`;
}
