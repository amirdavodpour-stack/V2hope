import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;
const api = fs.readFileSync(new URL('../../lib/core/network/api_client.dart', import.meta.url), 'utf8');
const telemetry = fs.readFileSync(new URL('../../lib/core/telemetry/telemetry_service.dart', import.meta.url), 'utf8');

test('mobile API retries only idempotent GET requests and never mutating requests', () => {
  assert.equal(api.includes("final canRetry = normalizedMethod == 'GET';"), true);
  assert.match(api, /_maxIdempotentRetries = 2/);
  assert.match(api, /status == 408/);
  assert.match(api, /status == 429/);
  assert.match(api, /status == 502/);
  assert.match(api, /if \(!canRetry \|\| attempt >= _maxIdempotentRetries\) break;/);
});

test('mobile telemetry has no stale release-version fallback', () => {
  assert.match(telemetry, /HOPE_VERSION.*defaultValue: '0\.0\.0'/s);
  assert.doesNotMatch(telemetry, /defaultValue: '4\.0\.8'/);
});

console.log('WAVE13_RESILIENCE_CONTRACT_PASS');
