import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const workflow = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
const tool = fs.readFileSync(path.join(root, 'backend/tools/release_manifest.mjs'), 'utf8');

test('production release verifies APK signature when apksigner is available', () => {
  assert.match(workflow, /apksigner verify --verbose/);
});

test('production release generates cryptographic provenance for the APK', () => {
  assert.match(workflow, /actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4\.2\.2/);
  assert.ok(workflow.includes('subject-path: ${{ steps.artifact_meta.outputs.apk }}'));
  assert.match(workflow, /attestations: write/);
  assert.match(workflow, /id-token: write/);
});

test('production release publishes an integrity manifest with APK SHA-256', () => {
  assert.match(workflow, /release:manifest/);
  assert.match(workflow, /release-manifest\.json/);
  assert.match(tool, /sha256/);
  assert.match(tool, /GITHUB_SHA/);
  assert.match(tool, /stagingCertificationStatus/);
  assert.match(tool, /stagingCertificationSha/);
  assert.match(tool, /stagingCertificationAttempt/);
});


test('release manifest binds a content-addressed dependency and SBOM digest', () => {
  assert.match(tool, /dependencyState/);
  assert.match(tool, /pubspecLock/);
  assert.match(tool, /backendPackageLock/);
  assert.match(tool, /gradleWrapperProperties/);
  assert.match(tool, /sbomDigest/);
  assert.match(tool, /requires pubspec\.lock to compute dependency provenance/);
  assert.match(tool, /requires backend\/package-lock\.json to compute dependency provenance/);
  assert.match(tool, /requires backend\/sbom\.json to compute an SBOM digest/);
});

test('production workflow generates the SBOM before publishing the release manifest', () => {
  const releaseManifestIndex = workflow.indexOf('release:manifest');
  const sbomIndex = workflow.indexOf('npm run sbom');
  assert.ok(sbomIndex > -1 && releaseManifestIndex > -1 && sbomIndex < releaseManifestIndex);
});

test('reusable staging workflow exposes its certification run id to production', () => {
  const staging = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
  assert.match(staging, /certification_run_id:/);
  assert.match(staging, /jobs\.staging-certification\.outputs\.certification_run_id/);
  assert.match(staging, /certification_sha:/);
  assert.match(staging, /certification_attempt:/);
});


test('production release manifest fails closed when staging certification evidence is missing or mismatched', () => {
  const source = fs.readFileSync(path.join(root, 'backend/tools/release_manifest.mjs'), 'utf8');
  assert.match(source, /isProduction/);
  assert.match(source, /requires PASS staging certification/);
  assert.match(source, /requires staging certification run id/);
  assert.match(source, /certification SHA must match the release SHA/);
  assert.match(source, /requires a numeric staging certification attempt/);
  assert.doesNotMatch(source, /STAGING_CERTIFICATION_STATUS \|\| 'PASS'/);
});
