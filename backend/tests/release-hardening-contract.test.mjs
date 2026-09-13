import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname, '..');

test('Flutter lockfile never commits a session-local package registry', () => {
  const lock = fs.readFileSync(path.join(root, 'pubspec.lock'), 'utf8');
  assert.doesNotMatch(lock, /url: \"http:\/\/(127\.0\.0\.1|localhost):[0-9]+\"/);
  const verifier = fs.readFileSync(path.join(root, 'tools/verify-pubspec-lock-fresh.sh'), 'utf8');
  assert.match(verifier, /session-local package registry URL/);
});

test('release-oriented mobile workflows fail closed on lock drift', () => {
  for (const name of ['main.yml', 'device-integration.yml', 'staging-certification.yml', 'production-release.yml']) {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.match(workflow, /verify-pubspec-lock-fresh\.sh/);
    assert.doesNotMatch(workflow, /verify-pubspec-lock-fresh\.sh\s*\|\|/);
  }
});

test('mobile CI does not re-resolve dependencies after lock verification', () => {
  const checks = [
    ['main.yml', /flutter test --no-pub/],
    ['device-integration.yml', /flutter test --no-pub integration_test/],
    ['staging-certification.yml', /flutter test --no-pub/],
    ['production-release.yml', /flutter test --no-pub/],
  ];
  for (const [name, expected] of checks) {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.match(workflow, expected);
  }
});

test('CI never contains the placeholder API host and requires a real HTTPS secret', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/main.yml'), 'utf8');
  assert.doesNotMatch(workflow, /api\.hope\.example\.invalid/);
  assert.match(workflow, /secrets\.API_BASE_URL/);
  assert.match(workflow, /API_BASE_URL secret is required/);
  assert.match(workflow, /API_BASE_URL must use HTTPS/);
  assert.match(workflow, /contains whitespace or is malformed/);
  assert.match(workflow, /\^https:\/\/\[\^\[:space:\]\]\+\$/);
});

test('SBOM reports the current application version', () => {
  const sbom = JSON.parse(fs.readFileSync(path.join(root, 'backend/sbom.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
  assert.equal(sbom.metadata.component.version, packageJson.version);
});


test('production payment adapter is real-provider-capable and compose injects its contract', () => {
  const provider = fs.readFileSync(path.join(root, 'backend/src/payment_provider.js'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'backend/src/config.js'), 'utf8');
  const compose = fs.readFileSync(path.join(root, 'backend/docker-compose.yml'), 'utf8');
  assert.match(provider, /name === 'webhook'/);
  assert.match(provider, /PAYMENT_PROVIDER_CREATE_URL/);
  assert.match(provider, /PAYMENT_PROVIDER_RELEASE_URL/);
  assert.match(provider, /PAYMENT_PROVIDER_REFUND_URL/);
  assert.match(config, /PAYMENT_PROVIDER=webhook is required in production/);
  for (const name of ['PAYMENT_PROVIDER_TOKEN','PAYMENT_PROVIDER_CREATE_URL','PAYMENT_PROVIDER_RELEASE_URL','PAYMENT_PROVIDER_REFUND_URL','NOTIFICATION_PUSH_URL','NOTIFICATION_EMAIL_URL','NOTIFICATION_PROVIDER_TOKEN']) {
    assert.match(compose, new RegExp(name));
  }
});

test('production compose uses loopback binding and non-privileged readonly container', () => {
  const compose = fs.readFileSync(path.join(root, 'backend/docker-compose.yml'), 'utf8');
  assert.match(compose, /127\.0\.0\.1:3000:3000/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /read_only: true/);
});


test('production env validator exists and Docker image carries it', () => {
  const validator = fs.readFileSync(path.join(root, 'backend/scripts/validate-production-env.sh'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(root, 'backend/Dockerfile'), 'utf8');
  assert.match(validator, /Production environment contract PASS/);
  assert.match(validator, /PAYMENT_PROVIDER_CREATE_URL/);
  assert.match(dockerfile, /validate-production-env\.sh/);
  assert.match(dockerfile, /ENTRYPOINT \["\/app\/entrypoint\.sh"\]/);
  assert.match(dockerfile, /HEALTHCHECK/);
});

test('production CI blocks on high-severity npm audit findings', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
  assert.match(workflow, /npm audit --audit-level=high/);
});

test('main CI blocks on high-severity npm audit findings', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/main.yml'), 'utf8');
  assert.match(workflow, /npm audit --audit-level=high/);
  // the audit result is recorded as runtime evidence, but its exit status must
  // still fail the job -- evidence collection may never swallow a finding.
  assert.match(workflow, /exit "\$status"/);
});

test('SBOM covers the locked dependency tree, not only direct dependencies', () => {
  const sbom = JSON.parse(fs.readFileSync(path.join(root, 'backend/sbom.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'backend/package-lock.json'), 'utf8'));
  const lockedCount = Object.keys(lock.packages || {}).filter((k) => k).length;
  assert.ok(sbom.components.length >= lockedCount);
});


test('production release builds the backend Docker image as a production-only concern after staging certification', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
  assert.match(workflow, /needs: staging-certification/);
  assert.match(workflow, /name: Build production backend image/);
  assert.match(workflow, /docker build --pull --file Dockerfile --tag hope-api:\$\{GITHUB_SHA\} \./);
  assert.doesNotMatch(workflow, /name: External integration gate/);
});

test('production release is protected and must originate from an immutable version tag', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
  assert.match(workflow, /environment:\s+production/);
  assert.match(workflow, /Enforce immutable release tag/);
  assert.match(workflow, /refs\/tags\/v/);
  assert.match(workflow, /Release tag \$TAG does not match application version v\$VERSION/);
});


test('production release delegates staging certification and does not consume staging secrets in the production job', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
  assert.match(workflow, /staging-certification:/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/staging-certification\.yml/);
  assert.match(workflow, /needs: staging-certification/);
  assert.doesNotMatch(workflow, /API_BASE_URL_STAGING/);
  assert.doesNotMatch(workflow, /STAGING_DATABASE_URL/);
  assert.doesNotMatch(workflow, /STAGING_S3_ENDPOINT/);
});

test('staging certification is reusable and contains the external, DR, and device gates', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
  assert.match(workflow, /workflow_call:/);
  for (const marker of ['Staging external integration gate','Staging product workflow','Staging operational gate','DR restore drill','Android emulator certification']) {
    assert.match(workflow, new RegExp(marker));
  }
  assert.match(workflow, /STAGING_S3_ENDPOINT/);
  assert.match(workflow, /DRILL_DATABASE_URL/);
});

test('staging S3 probe never asserts HTTPS against a non-TLS endpoint', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
  const s3StepMatch = workflow.match(/name: S3 runtime probe[\s\S]*?(?=\n {6}- name:)/);
  assert.ok(s3StepMatch, 'S3 runtime probe step not found');
  const step = s3StepMatch[0];
  const endpointMatch = step.match(/STAGING_S3_ENDPOINT:\s*(\S+)/);
  const requireHttpsMatch = step.match(/S3_REQUIRE_HTTPS:\s*'([^']*)'/);
  assert.ok(endpointMatch && requireHttpsMatch, 'S3 endpoint/require-https env not found');
  const endpointIsHttps = endpointMatch[1].startsWith('https://');
  // If the endpoint this job actually connects to is plain http, requiring
  // an https:// presigned URL back out is an unsatisfiable, self-contradictory
  // gate (see backend/tests/s3-integration.test.mjs). Production HTTPS
  // enforcement lives in backend/src/config.js instead.
  if (!endpointIsHttps) assert.notEqual(requireHttpsMatch[1], '1');
});

test('staging certification requires a real external staging base URL and does not fall back to localhost', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
  assert.match(workflow, /secrets:\s*\n\s*STAGING_BASE_URL:/);
  assert.doesNotMatch(workflow, /PERF_BASE_URL: http:\/\/127\.0\.0\.1/);
  assert.doesNotMatch(workflow, /STAGING_BASE_URL: http:\/\/127\.0\.0\.1/);
  assert.match(workflow, /PERF_BASE_URL: \$\{\{ secrets\.STAGING_BASE_URL \}\}/);
  assert.match(workflow, /STAGING_BASE_URL: \$\{\{ secrets\.STAGING_BASE_URL \}\}/);
});


test('CI Android toolchain is explicit and release builds enforce the lockfile', () => {
  const setup = fs.readFileSync(path.join(root, 'tools/ci-android-toolchain.sh'), 'utf8');
  assert.match(setup, /platforms;android-36/);
  assert.match(setup, /build-tools;36\.0\.0/);
  assert.match(setup, /ndk;28\.2\.13676358/);
  assert.match(setup, /sdkmanager/);

  const build = fs.readFileSync(path.join(root, 'tools/build_release_isolated.sh'), 'utf8');
  assert.match(build, /flutter pub get --enforce-lockfile/);
  const apk = fs.readFileSync(path.join(root, 'tools/build_apk_release.sh'), 'utf8');
  assert.match(apk, /flutter pub get --enforce-lockfile/);
});

test('staging Android quality gate uses one canonical debug build path', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/staging-certification.yml', import.meta.url), 'utf8');
  const block = workflow.slice(workflow.indexOf('name: Android quality gates'), workflow.indexOf('name: Android emulator certification'));
  assert.equal((block.match(/bash tools\/build_apk_debug\.sh/g) || []).length, 1);
  assert.equal((block.match(/^\s*flutter build apk --debug/gm) || []).length, 0);
  assert.equal((block.match(/^\s*flutter analyze$/gm) || []).length, 0);
  assert.equal((block.match(/^\s*flutter test --no-pub$/gm) || []).length, 0);
});

test('production release derives canonical APK artifact from pubspec version', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
  assert.doesNotMatch(workflow, /HOPE-3\.8\.0\+11-production\.apk/);
  assert.match(workflow, /HOPE-\$\{VERSION\}-production\.apk/);
  assert.match(workflow, /steps\.artifact_meta\.outputs\.apk/);
});

test('Android Gradle launcher is executable and does not depend on a missing wrapper jar', () => {
  const wrapper = fs.readFileSync(path.join(root, 'android/gradlew'), 'utf8');
  assert.match(wrapper, /distributionUrl/);
  const props = fs.readFileSync(path.join(root, 'android/gradle/wrapper/gradle-wrapper.properties'), 'utf8');
  assert.ok(props.includes('gradle-8.14.3-bin.zip'));
  assert.ok(props.includes('https\\://services.gradle.org/distributions/'));
  assert.match(wrapper, /GRADLE_DISTRIBUTION_SHA256|\.sha256/);
  assert.doesNotMatch(wrapper, /CLASSPATH=.*gradle-wrapper\.jar/);
  assert.equal(fs.statSync(path.join(root, 'android/gradlew')).mode & 0o111, 0o111);
});

test('release manifest records content-addressed backend image identity when supplied', () => {
  const manifest = fs.readFileSync(path.join(root, 'backend/tools/release_manifest.mjs'), 'utf8');
  assert.match(manifest, /BACKEND_IMAGE_ID/);
  assert.match(manifest, /backendImage:/);
});

test('APK build helper uses portable base64 encoding for Dart defines', () => {
  const build = fs.readFileSync(path.join(root, 'tools/build_apk_release.sh'), 'utf8');
  assert.match(build, /base64 \| tr -d '\\n'/);
  assert.doesNotMatch(build, /base64 -w0/);
});

test('release APK helper fails closed on non-HTTPS or malformed API base URLs', () => {
  const build = fs.readFileSync(path.join(root, 'tools/build_apk_release.sh'), 'utf8');
  assert.match(build, /ERROR: API_BASE_URL must use HTTPS for a release build\./);
  assert.match(build, /: "\$\{API_BASE_URL:\?Set API_BASE_URL/);
  assert.doesNotMatch(build, /API_BASE_URL:=https:\/\//);
});


test('migration checker covers every committed migration file', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
  const script = packageJson.scripts?.['check:migrations'] || '';
  const files = fs.readdirSync(path.join(root, 'backend/src/db/migrations'))
    .filter((name) => /^\d+_[a-z0-9_]+\.js$/i.test(name))
    .sort();
  assert.ok(files.length >= 1);
  for (const file of files) {
    assert.match(script, new RegExp(file.replace('.', '\\.') + '$|'+file.replace('.', '\\.')+' &&|'+file.replace('.', '\\.')+';'));
  }
});
