import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('.', import.meta.url).pathname, '..');

test('migration defines trust_reports exactly once', () => {
  const sql = fs.readFileSync(path.join(root, 'src/db/schema.js'), 'utf8');
  const matches = sql.match(/CREATE TABLE IF NOT EXISTS trust_reports/g) || [];
  assert.equal(matches.length, 1);
});

test('DR scripts are fail-closed and backup validation is non-destructive', () => {
  const backup = fs.readFileSync(path.join(root, 'scripts/backup.sh'), 'utf8');
  const verify = fs.readFileSync(path.join(root, 'scripts/verify-backup.sh'), 'utf8');
  const restore = fs.readFileSync(path.join(root, 'scripts/restore.sh'), 'utf8');
  assert.match(backup, /pg_dump/);
  assert.match(backup, /mtime \+14/);
  assert.match(verify, /pg_restore --list/);
  assert.doesNotMatch(verify, /pg_restore --clean/);
  assert.match(restore, /pg_restore --clean/);
  assert.match(restore, /backup file required/);
});

test('staging smoke script uses HTTPS, bounded curl, and safe read-only checks', () => {
  const script = fs.readFileSync(path.join(root, '..', 'tools/staging-smoke.sh'), 'utf8');
  assert.match(script, /STAGING_BASE_URL/);
  assert.match(script, /https:\/\//);
  assert.match(script, /--connect-timeout 5/);
  assert.match(script, /--max-time 10/);
  assert.match(script, /categories/);
  assert.doesNotMatch(script, /POST|DELETE|PUT|PATCH/);
});


test('production release workflow requires reusable staging certification before signing', () => {
  const workflow = fs.readFileSync(path.join(root, '..', '.github/workflows/production-release.yml'), 'utf8');
  const gate = workflow.indexOf('uses: ./.github/workflows/staging-certification.yml');
  const signing = workflow.indexOf('Configure production keystore');
  assert.ok(gate >= 0);
  assert.ok(signing > gate);
  assert.match(workflow.slice(0, signing), /needs: staging-certification/);
  assert.match(workflow, /certification_status == 'PASS'/);
});

test('DR document requires isolated restore evidence before release certification', () => {
  const dr = fs.readFileSync(path.join(root, '..', 'DISASTER-RECOVERY.md'), 'utf8');
  assert.match(dr, /isolated database/i);
  assert.match(dr, /restore/i);
  assert.match(dr, /evidence/i);
});


test('DR restore drill is fail-closed, validates archive, restores into an isolated target, and writes evidence', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/dr-restore-drill.sh'), 'utf8');
  assert.match(script, /SOURCE_DATABASE_URL/);
  assert.match(script, /DRILL_DATABASE_URL/);
  assert.match(script, /pg_dump/);
  assert.match(script, /verify-backup\.sh/);
  assert.match(script, /pg_restore --exit-on-error --clean/);
  assert.match(script, /information_schema\.tables/);
  assert.match(script, /DRILL_EVIDENCE_FILE/);
  assert.match(script, /Result: PASS/);
  assert.match(script, /required=\"users,categories,jobs,offers,payments,outbox_events\"/);
  assert.match(script, /to_regclass/);
});

test('dedicated DR CI workflow provisions separate source and drill PostgreSQL services', () => {
  const workflow = fs.readFileSync(path.join(root, '..', '.github/workflows/dr-restore.yml'), 'utf8');
  assert.match(workflow, /source-db:/);
  assert.match(workflow, /drill-db:/);
  assert.match(workflow, /54321:5432/);
  assert.match(workflow, /54322:5432/);
  assert.match(workflow, /npm run migrate/);
  assert.match(workflow, /dr-restore-drill\.sh/);
  assert.match(workflow, /actions\/upload-artifact/);
});
