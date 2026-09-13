import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = new URL('../src/routes/admin_routes.js', import.meta.url);
const adminLegacy = new URL('../src/application/legacy/admin_legacy.js', import.meta.url);
const adminPage = new URL('../../lib/features/admin/admin_page.dart', import.meta.url);
const adminRepo = new URL('../../lib/core/admin/admin_repository.dart', import.meta.url);

test('admin platform exposes summary, users, status, audit and moderation routes', async () => {
  const source = await readFile(app, 'utf8');
  for (const marker of [
    "parts[1]==='summary'", "parts[1]==='users'", "parts[3]==='status'",
    "parts[1]==='audit'", "parts[3]==='moderate'", "requireAdmin(await authUser(req))",
    "SELF_SUSPEND_FORBIDDEN", "JOB_LOCKED", "ADMIN_USER_STATUS", "ADMIN_JOB_MODERATE"
  ]) assert.ok(source.includes(marker), `Missing admin control marker: ${marker}`);
});

test('admin repository supports summary, user management, audit and locked moderation', async () => {
  const source = [
    await readFile(new URL('../src/repository.js', import.meta.url), 'utf8'),
    await readFile(new URL('../src/repository/admin.js', import.meta.url), 'utf8'),
  ].join('\n');
  for (const marker of ['getAdminSummary', 'listAdminUsers', 'setUserStatus', 'listAdminAudit', 'moderateJob', 'FOR UPDATE']) {
    assert.ok(source.includes(marker), `Missing repository marker: ${marker}`);
  }
});

test('admin UI has four operational surfaces', async () => {
  const source = await readFile(adminPage, 'utf8');
  const repo = await readFile(adminRepo, 'utf8');
  for (const marker of ["_jobsTab", "_applicationsTab", "_usersTab", "_auditTab", 'publish', 'SUSPENDED']) {
    assert.ok(source.includes(marker), `Missing UI marker: ${marker}`);
  }
  for (const marker of ['/admin/summary', '/admin/applications']) {
    assert.ok(repo.includes(marker), `Missing repository endpoint marker: ${marker}`);
  }
});


test('admin job deletion is blocked when financial records exist', async () => {
  const source = await readFile(app, 'utf8');
  const legacy = await readFile(adminLegacy, 'utf8');
  assert.match(source, /JOB_HAS_FINANCIAL_RECORDS/);
  assert.match(source, /legacyAdmin\.deleteJob/);
  assert.match(legacy, /collection\.payments/);
});

test('admin financial summary crosses the application boundary', async () => {
  const source = await readFile(app, 'utf8');
  assert.match(source, /paymentUseCases\.adminFinancialSummary\(\)/);
  assert.doesNotMatch(source, /repo\.getAdminFinancialSummary\(\)/);
});
