import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('configuration contract has an executable example and machine validator', () => {
  assert.ok(fs.existsSync(path.join(root, 'backend/.env.example')));
  assert.ok(fs.existsSync(path.join(root, 'backend/tools/validate-config-contract.mjs')));
  assert.match(read('backend/package.json'), /check:config-contract/);
  assert.match(read('docs/CONFIGURATION-CONTRACT.md'), /\*\*Contract version:\*\*\s*2026-09-06/);
});

test('backend payment documentation matches production policy', () => {
  const backendReadme = read('backend/README.md');
  assert.match(backendReadme, /PAYMENT_PROVIDER=webhook/);
  assert.doesNotMatch(backendReadme, /currently only supports `simulator`/);
});

test('production release is tag-bound and canonicalizes the release artifact', () => {
  const workflow = read('.github/workflows/production-release.yml');
  assert.match(workflow, /GITHUB_REF_TYPE.*tag/);
  assert.match(workflow, /refs\/tags\/\$TAG/);
  assert.match(workflow, /HOPE-\$\{VERSION\}-production\.apk/);
  assert.doesNotMatch(workflow, /HOPE-3\.8\.0\+11-production\.apk/);
  assert.match(workflow, /attest-build-provenance/);
});

test('pilot build has a distinct application id', () => {
  const gradle = read('android/app/build.gradle.kts');
  const build = read('tools/build_apk_release.sh');
  assert.match(gradle, /applicationIdSuffix = if \(profile == "pilot"\) "\.pilot" else ""/);
  assert.match(build, /EXPECTED_PACKAGE="com\.hope\.marketplace"/);
  assert.match(build, /com\.hope\.marketplace\.pilot/);
});

test('release manifest captures the real application version separately from toolchain versions', () => {
  const manifest = read('backend/tools/release_manifest.mjs');
  assert.match(manifest, /appVersion/);
  assert.match(manifest, /flutter:\s*flutterMachine\?\.frameworkVersion/);
  assert.match(manifest, /androidGradlePlugin/);
  assert.match(manifest, /gradle:/);
  assert.doesNotMatch(manifest, /flutterVersion:\s*versionMatch/);
});
