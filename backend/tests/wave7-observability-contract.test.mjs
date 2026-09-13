import assert from 'node:assert/strict';
import { businessHealth } from '../src/business_metrics.js';
import { localProductFunnelSummary } from '../src/analytics.js';

assert.equal(businessHealth({requests:100,errors5xx:0,requestDurationBuckets:{gte500:0}}).alerts.length,0);
assert.equal(businessHealth({requests:100,errors5xx:3,requestDurationBuckets:{gte500:0}}).alerts[0].code,'HTTP_5XX_RATE_HIGH');
assert.equal(businessHealth({requests:100,errors5xx:0,requestDurationBuckets:{gte500:25}}).alerts[0].code,'SLOW_REQUEST_RATE_HIGH');
const funnel=localProductFunnelSummary(30);
assert.ok(Array.isArray(funnel.funnel));
assert.equal(funnel.funnel.length,10);
console.log('WAVE7_CONTRACT_PASS');
