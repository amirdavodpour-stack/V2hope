import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const gradle = fs.readFileSync(new URL('../../android/app/build.gradle.kts', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../../.github/workflows/main.yml', import.meta.url), 'utf8');
const releaseWorkflow = fs.readFileSync(new URL('../../.github/workflows/production-release.yml', import.meta.url), 'utf8');

test('production backend rejects simulator payment provider and weak secrets', () => {
  assert.match(config, /PAYMENT_PROVIDER=webhook is required in production/);
  assert.match(config, /length < 32/);
  assert.match(config, /PAYMENT_WEBHOOK_SECRET/);
});

test('production Android builds cannot silently use debug signing', () => {
  assert.match(gradle, /versionCode = appVersionCode/);
  assert.match(gradle, /versionName = appVersionName/);
  assert.match(gradle, /BUILD_PROFILE.*lowercase\(\)[\s\S]*production/);
  assert.match(gradle, /Production (?:builds require|release requires) ANDROID_RELEASE_STORE_FILE/);
  assert.match(gradle, /isMinifyEnabled = profile == "production"/);
});

test('production release installs pinned backend dependencies before npm tooling', () => {
  const checkout = releaseWorkflow.indexOf('- name: Checkout');
  const npmCi = releaseWorkflow.indexOf('run: npm ci', checkout);
  const sbom = releaseWorkflow.indexOf('npm run sbom', checkout);
  assert.ok(npmCi > checkout);
  assert.ok(sbom > npmCi);
});

test('production release workflow is manual and uses the hardened release script', () => {
  assert.match(releaseWorkflow, /workflow_dispatch/);
  assert.match(releaseWorkflow, /BUILD_PROFILE: production/);
  assert.match(releaseWorkflow, /build_apk_release\.sh/);
  assert.match(releaseWorkflow, /ANDROID_RELEASE_KEYSTORE_B64/);
  assert.match(releaseWorkflow, /npm run check:all/);
  assert.match(releaseWorkflow, /flutter analyze/);
  assert.match(releaseWorkflow, /flutter test/);
  assert.match(releaseWorkflow, /steps\.artifact_meta\.outputs\.apk/);
  assert.match(releaseWorkflow, /SHA256SUMS\.txt/);
});

test('CI contains backend and mobile quality gates before artifact release', () => {
  assert.match(workflow, /npm run check:all/);
  assert.match(workflow, /flutter analyze/);
  assert.match(workflow, /flutter test/);
  assert.match(workflow, /API_BASE_URL secret is required/);
});

test('configuration rejects invalid numeric operational limits', () => {
  assert.match(config, /positiveIntegerEnv/);
  for (const marker of [
    "PORT', 3000, { min: 1, max: 65535 }",
    "MAX_REQUEST_BYTES', 1024 \\* 1024, { min: 1024",
    "PG_POOL_MAX', 10, { min: 1, max: 100 }",
    "GENERAL_RATE_LIMIT_MAX', 120, { min: 1, max: 10000 }",
    "MAX_IDEMPOTENCY_KEY_LENGTH', 200, { min: 16, max: 1024 }"
  ]) assert.match(config, new RegExp(marker));
});


test('pilot release uses debug signing while production requires explicit release signing', () => {
  const gradle = fs.readFileSync(new URL('../../android/app/build.gradle.kts', import.meta.url), 'utf8');
  assert.match(gradle, /"pilot"[\s\S]*signingConfig = signingConfigs\.getByName\("debug"\)/);
  assert.match(gradle, /"production"[\s\S]*signingConfig = signingConfigs\.getByName\("release"\)/);
  assert.match(gradle, /Production (?:builds require|release requires) ANDROID_RELEASE_STORE_FILE/);
});
