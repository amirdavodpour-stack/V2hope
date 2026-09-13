import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('marketplace/job routes do not access the persistence facade directly', () => {
  for (const file of ['backend/src/routes/job_routes.js', 'backend/src/routes/job_handlers.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /db\.(?:collection|insert|update|touch|save)\b/, `${file} must use repository/use-case boundaries`);
  }
});

test('job legacy persistence is isolated behind an explicit test adapter', () => {
  const adapter = read('backend/src/application/legacy/job_legacy.js');
  const app = read('backend/src/app.js');
  assert.match(adapter, /createJobLegacyAdapter/);
  assert.match(adapter, /db\.collection/);
  assert.match(app, /createJobLegacyAdapter/);
});

test('admin routes stay behind use-case/legacy adapter boundaries', () => {
  const routes = read('backend/src/routes/admin_routes.js');
  assert.doesNotMatch(routes, /db\.(?:collection|insert|update|touch|save)\b/);
  assert.match(routes, /adminUseCases/);
  assert.match(routes, /legacyAdmin/);
});

test('all HTTP routes stay behind persistence boundaries', () => {
  const routeDir = path.join(root, 'backend/src/routes');
  for (const file of fs.readdirSync(routeDir).filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(routeDir, file), 'utf8');
    assert.doesNotMatch(source, /db\.(?:collection|insert|update|touch|save)\b/, `${file} must not access persistence facade directly`);
  }
});
