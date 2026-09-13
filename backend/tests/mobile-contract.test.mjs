import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');

test('mobile app uses build-time API configuration and never ships the placeholder API host', () => {
  const main = fs.readFileSync(path.join(root, 'lib/main.dart'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'lib/core/network/api_client.dart'), 'utf8');
  assert.match(main, /ApiClient\(store\)/);
  assert.doesNotMatch(main, /api\.hope\.example\.invalid/);
  assert.match(client, /String\.fromEnvironment\('API_BASE_URL'\)/);
});

test('Android manifest requests location permissions needed by the settings flow', () => {
  const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /ACCESS_FINE_LOCATION/);
});
