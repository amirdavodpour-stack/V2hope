import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('release candidate validation script is executable and fail-closed', () => {
  const file = path.join(root, 'tools', 'release_candidate_check.sh');
  const stat = fs.statSync(file);
  assert.equal((stat.mode & 0o111) !== 0, true);
  const body = fs.readFileSync(file, 'utf8');
  assert.match(body, /set -euo pipefail/);
  assert.match(body, /STATUS: VALIDATION-INCOMPLETE/);
  assert.match(body, /flutter analyze/);
  assert.match(body, /docker compose config -q/);
});
