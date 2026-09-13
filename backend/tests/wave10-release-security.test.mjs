import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('Android release signing never falls back to debug', () => {
  const src = fs.readFileSync(new URL('../../android/app/build.gradle.kts', import.meta.url), 'utf8');
  assert.match(src, /Production (?:builds require|release requires) ANDROID_RELEASE_STORE_FILE/);
  assert.match(src, /"pilot"[\s\S]*signingConfigs\.getByName\("debug"\)/);
  assert.match(src, /"production"[\s\S]*signingConfigs\.getByName\("release"\)/);
});

test('production environment remains fail-closed for external integrations', () => {
  const src = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  for (const marker of [
    'DATABASE_URL must be set in production',
    'STORAGE_BACKEND=s3 is required in production',
    'PAYMENT_PROVIDER=webhook is required in production',
    'NOTIFICATION_PUSH_URL must use HTTPS in production',
    'NOTIFICATION_EMAIL_URL must use HTTPS in production',
    'RESET_TOKEN_DELIVERY_MODE=webhook is required in production'
  ]) assert.match(src, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('payment webhook uses timing-safe HMAC verification and atomic persistence', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const paymentRoutes = fs.readFileSync(new URL('../src/routes/payment_routes.js', import.meta.url), 'utf8');
  const repo = fs.readFileSync(new URL('../src/repository/payment_webhooks.js', import.meta.url), 'utf8');
  assert.match(paymentRoutes, /crypto\.timingSafeEqual/);
  assert.match(repo, /ON CONFLICT\(event_id\) DO NOTHING RETURNING payment_id/);
  assert.match(repo, /payment_webhook_events/);
});

test('production release is bound to staging certification evidence and carries its run id into the release manifest', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/production-release.yml', import.meta.url), 'utf8');
  const stagingWorkflow = fs.readFileSync(new URL('../../.github/workflows/staging-certification.yml', import.meta.url), 'utf8');
  const manifest = fs.readFileSync(new URL('../tools/release_manifest.mjs', import.meta.url), 'utf8');

  assert.match(workflow, /staging-certification\.outputs\.certification_status == 'PASS'/);
  assert.match(workflow, /STAGING_CERTIFICATION_RUN_ID/);
  assert.match(workflow, /needs\.staging-certification\.outputs\.certification_run_id/);
  assert.match(stagingWorkflow, /certification_run_id: \$\{\{ github\.run_id \}\}/);
  assert.match(stagingWorkflow, /Android emulator certification/);
  assert.match(stagingWorkflow, /Upload staging certification evidence/);
  assert.match(manifest, /stagingCertificationRunId/);
});


test('production release requires explicit RELEASE confirmation and staging run-id output', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/production-release.yml', import.meta.url), 'utf8');
  const staging = fs.readFileSync(new URL('../../.github/workflows/staging-certification.yml', import.meta.url), 'utf8');
  assert.match(workflow, /Require explicit release confirmation/);
  assert.match(workflow, /CONFIRM:/);
  assert.match(workflow, /CONFIRM:-/);
  assert.match(workflow, /RELEASE/);
  assert.match(staging, /certification_run_id:/);
  assert.match(staging, /jobs\.staging-certification\.outputs\.certification_run_id/);
});

test('staging PASS is emitted only after Android runtime certification', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/staging-certification.yml', import.meta.url), 'utf8');
  assert.ok(workflow.indexOf('name: Android emulator certification') < workflow.indexOf('name: Emit certification status'));
  assert.match(workflow, /name: Android quality gates/);
  assert.match(workflow, /bash tools\/build_apk_debug\.sh/);
  const helper = fs.readFileSync(new URL('../../tools/build_apk_debug.sh', import.meta.url), 'utf8');
  assert.match(helper, /flutter analyze/);
  assert.match(helper, /flutter test --no-pub/);
  assert.match(helper, /flutter build apk --debug/);
});

test('staging certification PASS is fail-closed on provider integration and DR restore', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/staging-certification.yml', import.meta.url), 'utf8');
  const gate = workflow.slice(workflow.indexOf('name: Staging operational gate'), workflow.indexOf('name: Emit certification status'));
  assert.match(gate, /steps\.provider_integration\.outcome/);
  assert.match(gate, /steps\.dr_drill\.outcome/);
});
