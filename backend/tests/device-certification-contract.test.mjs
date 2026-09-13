import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const workflow = fs.readFileSync(path.join(root, '.github/workflows/device-integration.yml'), 'utf8');
const production = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
const staging = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
const smoke = fs.readFileSync(path.join(root, 'integration_test/runtime/app_smoke_test.dart'), 'utf8');

test('device certification workflow uses a pinned emulator runner and HTTPS staging', () => {
  assert.match(workflow, /reactivecircus\/android-emulator-runner@[0-9a-f]{40} # v2\.38\.0/);
  assert.match(workflow, /subosito\/flutter-action@[0-9a-f]{40} # v2\.23\.0/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40} # v6\.0\.2/);
  assert.match(workflow, /api-level: 35/);
  assert.match(workflow, /API_BASE_URL_STAGING/);
  assert.match(workflow, /https:\/\//);
  assert.match(workflow, /CI_DEVICE_INTEGRATION=true/);
});

test('staging certification performs device certification before any production signing job can run', () => {
  const deviceIndex = staging.indexOf('Android emulator certification');
  assert.ok(deviceIndex >= 0);
  assert.match(production, /needs: staging-certification/);
  assert.doesNotMatch(production, /API_BASE_URL_STAGING/);
  assert.match(staging, /subosito\/flutter-action@[0-9a-f]{40} # v2\.23\.0/);
  assert.match(staging, /reactivecircus\/android-emulator-runner@[0-9a-f]{40} # v2\.38\.0/);
  assert.match(staging, /certification_sha/);
  assert.match(staging, /certification_attempt/);
});

test('integration smoke derives the API endpoint from build-time configuration', () => {
  assert.match(smoke, /String\.fromEnvironment\('API_BASE_URL'/);
  assert.match(smoke, /CI_DEVICE_INTEGRATION/);
  assert.match(smoke, /\$baseUrl\/live/);
});
