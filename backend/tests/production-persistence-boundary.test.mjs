import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const adminRoutes = fs.readFileSync(new URL('../src/routes/admin_routes.js', import.meta.url), 'utf8');

function pgBranchFor(marker, call) {
  const branchStart = adminRoutes.indexOf(marker);
  assert.ok(branchStart >= 0, `missing route marker: ${marker}`);
  const callIndex = adminRoutes.indexOf(call, branchStart);
  assert.ok(callIndex > branchStart, `missing PostgreSQL application call: ${call}`);
  const nextLocal = adminRoutes.indexOf('db.collection.', callIndex);
  assert.ok(nextLocal < 0 || callIndex < nextLocal, `${call} must occur before local db fallback`);
  return { branchStart, callIndex, nextLocal };
}

test('admin trust reports use application port results directly in PostgreSQL runtime', () => {
  const { callIndex, nextLocal } = pgBranchFor(
    "if(req.method==='GET' && parts[0]==='admin' && parts[1]==='trust-reports')",
    'adminUseCases.trustReports(status)',
  );
  const segment = adminRoutes.slice(callIndex, nextLocal >= 0 ? nextLocal : callIndex + 160);
  assert.doesNotMatch(segment, /findUser\(/, 'PG trust-report branch must not enrich through local user lookup');
});

test('admin audit uses application port results directly in PostgreSQL runtime', () => {
  pgBranchFor(
    "if(req.method==='GET' && parts[0]==='admin' && parts[1]==='audit')",
    'adminUseCases.audit()',
  );
});
