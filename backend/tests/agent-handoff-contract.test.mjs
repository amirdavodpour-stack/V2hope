import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

for (const file of [
  'AGENT-HANDOFF-PROMPT.md',
  'AGENT-RESOURCE-POLICY.md',
  'tools/agent-preflight.sh',
  'tools/ci-resource-guard.sh',
]) {
  test(`agent handoff contract contains ${file}`, () => {
    const target = path.join(root, file);
    assert.equal(fs.existsSync(target), true, `${file} must exist`);
    const text = fs.readFileSync(target, 'utf8');
    assert.ok(text.length > 300, `${file} must contain substantive contract content`);
  });
}

test('canonical APK helper invokes resource guard before expensive build work', () => {
  const text = fs.readFileSync(path.join(root, 'tools/build_apk_debug.sh'), 'utf8');
  const guard = text.indexOf('bash tools/ci-resource-guard.sh');
  const preflight = text.indexOf('bash tools/android-build-preflight.sh');
  assert.ok(guard >= 0, 'resource guard invocation missing');
  assert.ok(preflight >= 0, 'android preflight invocation missing');
  assert.ok(guard < preflight, 'resource guard must run before Android preflight/build work');
});

test('offline backend suite is process-isolated so test env cannot bleed between files', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
  assert.equal(packageJson.scripts['test:offline'], 'NODE_ENV=test node tools/run-test-files-isolated.mjs');
  const runner = fs.readFileSync(path.join(root, 'backend/tools/run-test-files-isolated.mjs'), 'utf8');
  assert.match(runner, /spawnSync\(process\.execPath/);
  assert.match(runner, /delete env\.DATABASE_URL/);
  assert.match(runner, /--test-concurrency=1/);
});

test('handoff contract forbids unsupported PASS promotion', () => {
  const text = fs.readFileSync(path.join(root, 'AGENT-HANDOFF-PROMPT.md'), 'utf8');
  for (const needle of ['No fake green', 'Do **not** declare V1 COMPLETE', 'BLOCKED', 'UNVERIFIED']) {
    assert.ok(text.includes(needle), `handoff contract must preserve ${needle}`);
  }
});
