import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../../lib/core/network/api_client.dart', import.meta.url), 'utf8');

test('mobile api client normalizes network failures for user-visible recovery', () => {
  assert.match(file, /ApiException\('NETWORK_ERROR'/);
  assert.match(file, /ApiException\('TIMEOUT'/);
  assert.match(file, /onError\?\.call/);
});
