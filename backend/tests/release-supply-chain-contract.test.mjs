import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const workflows = fs.readdirSync(path.join(root, '.github', 'workflows')).filter((n) => n.endsWith('.yml'));

const expected = [
  /^actions\/checkout@[0-9a-f]{40} # v6\.0\.2$/,
  /^actions\/setup-node@[0-9a-f]{40} # v6\.4\.0$/,
  /^actions\/upload-artifact@[0-9a-f]{40} # v7\.0\.1$/,
  /^reactivecircus\/android-emulator-runner@[0-9a-f]{40} # v2\.38\.0$/,
  /^subosito\/flutter-action@[0-9a-f]{40} # v2\.23\.0$/,
  /^actions\/attest-build-provenance@[0-9a-f]{40} # v4\.2\.2$/,
];

test('CI workflow action refs are immutable full SHAs', () => {
  for (const file of workflows) {
    const lines = fs.readFileSync(path.join(root, '.github', 'workflows', file), 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim().startsWith('uses:')) continue;
      if (/actions\/checkout@|actions\/setup-node@|actions\/upload-artifact@|reactivecircus\/android-emulator-runner@|subosito\/flutter-action@/.test(line)) {
        const value = line.trim().replace(/^uses:\s*/, '');
        assert.ok(expected.some((re) => re.test(value)), `${file}: unexpected mutable/non-pinned action ref: ${value}`);
      }
    }
  }
});

test('production and resilience workflows run backend on Node 24', () => {
  for (const file of ['production-release.yml', 'staging-resilience.yml']) {
    const text = fs.readFileSync(path.join(root, '.github', 'workflows', file), 'utf8');
    assert.match(text, /node-version:\s*'24'/, `${file} must use Node 24`);
  }
});

test('production workflow cleans temporary release keystore', () => {
  const text = fs.readFileSync(path.join(root, '.github', 'workflows', 'production-release.yml'), 'utf8');
  assert.match(text, /Clean up production keystore/);
  assert.match(text, /rm -f -- \"\$KEYSTORE_PATH\"/);
});
