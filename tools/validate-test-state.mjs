import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const rootState = readJson('TEST-COMPLETION-STATE.json');
const testState = readJson('test-results/TEST-COMPLETION-STATE.json');
const summary = readJson('test-results/TEST-SUMMARY.json');

const errors = [];
if (rootState.session_id !== testState.session_id) errors.push('root/test-results completion state session_id mismatch');
if (rootState.session_id !== summary.test_session_id) errors.push('completion state / summary session mismatch');
if (rootState.build_performed !== false) errors.push('build_performed must remain false for test-only state');
if (rootState.deployment_performed !== false) errors.push('deployment_performed must remain false for test-only state');
if (rootState.source_files_modified === true || rootState.application_source_modified === true) {
  if (rootState.source_files_modified !== true || rootState.application_source_modified !== true || !rootState.maintenance_source_fix) errors.push('production-path maintenance requires truthful source modification declaration');
  const changelog = fs.readFileSync(path.join(root, 'test-results/CHANGELOG-TEST-FIXES.md'), 'utf8');
  if (!/MF-01[\s\S]*production-path hardening/i.test(changelog)) errors.push('maintenance source change is not documented as MF-01');
}
if (summary.totals?.flutter?.count === 0) errors.push('Flutter test count must be populated in canonical summary');
if (!String(summary.totals?.flutter?.status || '').startsWith('PASS')) errors.push('Flutter canonical status must indicate PASS when the latest full suite is green');
if (fs.existsSync(path.join(root, 'android/local.properties'))) errors.push('machine-specific android/local.properties must not be packaged');

const required = [
  'AGENT-HANDOFF-PROMPT.md',
  'AGENT-RESOURCE-POLICY.md',
  'backend/package.json',
  'backend/tools/run-postgres-isolated.mjs',
  'test-results/FINAL-TEST-REPORT.md',
  'test-results/TEST-MATRIX.csv',
  'test-results/TEST-SUMMARY.json',
  'test-results/TEST-COMPLETION-STATE.json',
  'test-results/COVERAGE-SUMMARY.md',
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) errors.push(`missing required artifact: ${rel}`);

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log(`Test-state integrity PASS (${rootState.session_id})`);
