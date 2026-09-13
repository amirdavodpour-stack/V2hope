import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
test('backend quality gates include mandatory e2e and coverage tooling',()=>{
 assert.match(pkg.scripts['check:all'],/test:e2e/);
 assert.match(pkg.scripts['test:coverage-gate'],/test_backend_coverage\.mjs/);
});
test('integration suites can be made fail-closed in CI',()=>{
 for(const file of ['postgres-bootstrap-integration.test.mjs','postgres-repository-e2e.test.mjs','s3-integration.test.mjs']){
  const s=fs.readFileSync(path.join(root,'tests',file),'utf8');
  assert.match(s,/REQUIRE_INTEGRATION === '1'/,file);
  assert.match(s,/throw new Error\(/,file);
 }
});
test('Flutter coverage gate exists',()=>{
 const p=path.join(root,'..','tools','test_flutter_coverage.sh');
 assert.equal(fs.existsSync(p),true);
});

test('database migrations are numbered, checksummed, gap-free, and transaction-ready',()=>{
 const runner=fs.readFileSync(path.join(root,'src','db','migrations.js'),'utf8');
 const m1=fs.readFileSync(path.join(root,'src','db','migrations','001_initial_schema.js'),'utf8');
 const m2=fs.readFileSync(path.join(root,'src','db','migrations','002_query_indexes.js'),'utf8');
 assert.match(runner,/createTableIfNotExists|CREATE TABLE IF NOT EXISTS schema_migrations/);
 assert.match(runner,/sha256/i);
 assert.match(runner,/pg_advisory_lock/);
 assert.match(runner,/BEGIN/);
 assert.match(runner,/ROLLBACK/);
 assert.match(m1,/version: 1/);
 assert.match(m2,/version: 2/);
 assert.match(pkg.scripts['migrate:status'],/src\/migrate\.js status/);
 assert.match(pkg.scripts['migrate:down'],/src\/migrate\.js down/);
});
