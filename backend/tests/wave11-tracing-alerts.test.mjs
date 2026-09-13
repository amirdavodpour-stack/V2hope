import test from 'node:test';
import assert from 'node:assert/strict';
import { traceContext, makeTraceparent } from '../src/tracing.js';
import { businessHealth } from '../src/business_metrics.js';
import { dispatchOperationalAlerts } from '../src/alerting.js';

test('traceparent is accepted and propagated with stable trace id', () => {
  const req = { headers: { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' } };
  const ctx = traceContext(req);
  assert.equal(ctx.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
  assert.equal(ctx.parentId, '00f067aa0ba902b7');
  assert.match(makeTraceparent(ctx), /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
});

test('invalid traceparent gets a new trace context', () => {
  const ctx = traceContext({ headers: { traceparent: 'garbage' } });
  assert.match(ctx.traceId, /^[0-9a-f]{32}$/);
  assert.equal(ctx.parentId, null);
});

test('business health raises critical and warning alerts deterministically', () => {
  const critical = businessHealth({ requests: 100, errors5xx: 3, requestDurationBuckets: { lt50: 97, gte500: 3 } });
  assert.equal(critical.alerts[0].code, 'HTTP_5XX_RATE_HIGH');
  assert.equal(critical.alerts[0].severity, 'critical');
  const warning = businessHealth({ requests: 100, errors5xx: 1, requestDurationBuckets: { lt50: 80, gte500: 20 } });
  assert.equal(warning.alerts[0].code, 'HTTP_5XX_RATE_ELEVATED');
  assert.equal(warning.alerts[1].code, 'SLOW_REQUEST_RATE_HIGH');
});


test('disabled alert delivery is a no-op', async () => {
  const result = await dispatchOperationalAlerts({ health: { alerts: [] } });
  assert.equal(result.dispatched, false);
});
