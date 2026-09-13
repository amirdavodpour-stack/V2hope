import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(backendDir, '..');
const script = path.join(projectRoot, 'tools', 'runtime-qualification-inventory.mjs');

test('qualification inventory resolves project root independently of cwd', () => {
  const output = execFileSync(process.execPath, [script], {
    cwd: backendDir,
    encoding: 'utf8',
    env: { ...process.env },
  });
  const inventory = JSON.parse(output);
  assert.equal(inventory.project_root, projectRoot);
  assert.equal(inventory.project_paths.android_gradlew, fs.existsSync(path.join(projectRoot, 'android', 'gradlew')));
  assert.equal(inventory.project_paths.status_integrity, true);
});
