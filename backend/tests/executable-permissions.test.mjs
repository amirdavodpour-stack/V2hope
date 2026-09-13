// Guards against packaging defects that can remove executable permissions.
// python3 -m zipfile does not preserve POSIX permission bits, so every shell
// script and android/gradlew arrived in the S20 workspace as mode 0644. That
// silently breaks tools/release_candidate_check.sh, the CI gate scripts and any
// Gradle invocation. Package with `zip` (preserves modes) and keep this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.dart_tool', '.gradle']);

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collect(path.join(dir, entry.name), out);
    } else if (entry.isFile() && entry.name.endsWith('.sh')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const isExecutable = (file) => (fs.statSync(file).mode & 0o111) !== 0;

test('every shell script in the tree is executable', () => {
  const scripts = collect(root);
  assert.ok(scripts.length > 0, 'expected to find shell scripts under the repository root');
  const notExecutable = scripts
    .filter((file) => !isExecutable(file))
    .map((file) => path.relative(root, file));
  assert.deepEqual(
    notExecutable,
    [],
    `these scripts lost their executable bit (repackage with \`zip\`, not python3 -m zipfile): ${notExecutable.join(', ')}`,
  );
});

test('android/gradlew is executable', () => {
  const gradlew = path.join(root, 'android', 'gradlew');
  assert.ok(fs.existsSync(gradlew), 'android/gradlew is missing from the tree');
  assert.equal(isExecutable(gradlew), true, 'android/gradlew is not executable; Gradle CI steps will fail');
});

test('every shell script starts with a shebang', () => {
  const missing = collect(root)
    .filter((file) => !fs.readFileSync(file, 'utf8').startsWith('#!'))
    .map((file) => path.relative(root, file));
  assert.deepEqual(missing, [], `shell scripts without a shebang: ${missing.join(', ')}`);
});
