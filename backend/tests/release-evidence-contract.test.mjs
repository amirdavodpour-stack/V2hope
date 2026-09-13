import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = fs.readFileSync(path.join(root, 'tools/release_candidate_check.sh'), 'utf8');

test('release candidate gate emits machine-readable evidence and is fail-closed', () => {
  assert.match(script, /RELEASE_STATUS/);
  assert.match(script, /RELEASE_GATES_PASSED/);
  assert.match(script, /RELEASE_GATES_BLOCKED/);
  assert.match(script, /release_evidence\.mjs/);
  assert.match(script, /exit 2/);
});

test('release evidence schema is deterministic and non-secret', () => {
  const source = fs.readFileSync(path.join(root, 'tools/release_evidence.mjs'), 'utf8');
  assert.match(source, /schemaVersion/);
  assert.match(source, /generatedAt/);
  assert.match(source, /commit/);
  assert.doesNotMatch(source, /ACCESS_TOKEN_SECRET|DATABASE_URL|PAYMENT_PROVIDER_TOKEN|AWS_SECRET_ACCESS_KEY/);
});


test('production release rejects staging evidence from a different commit', () => {
  const production = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
  assert.match(production, /certification_sha/);
  assert.match(production, /Certified staging commit does not match release commit/);
  assert.match(production, /CERT_SHA:-.*GITHUB_SHA/);
});

test('staging owns DR evidence and production consumes an explicit certification output', () => {
  const staging = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
  const production = fs.readFileSync(path.join(root, '.github/workflows/production-release.yml'), 'utf8');
  assert.match(staging, /DRILL_WORK_DIR:/);
  assert.match(staging, /DRILL_EVIDENCE_FILE:/);
  assert.match(staging, /test -s \"\$DRILL_EVIDENCE_FILE\"/);
  assert.match(staging, /Upload staging certification evidence/);
  assert.match(staging, /certification_status:/);
  assert.match(production, /needs: staging-certification/);
  assert.match(production, /needs\.staging-certification\.outputs\.certification_status/);
  assert.doesNotMatch(production, /DRILL_WORK_DIR:/);
  assert.doesNotMatch(production, /HOPE-production-dr-evidence/);
});
