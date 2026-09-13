import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');

test('taxonomy schema supports hierarchy, bilingual names, ordering and activation', () => {
  const schema = fs.readFileSync(path.join(root, 'backend/src/db/schema.js'), 'utf8');
  const db = fs.readFileSync(path.join(root, 'backend/src/db.js'), 'utf8');
  assert.match(schema, /parent_id UUID NULL REFERENCES categories/);
  assert.match(schema, /name_en TEXT/);
  assert.match(schema, /sort_order INTEGER/);
  assert.match(schema, /is_active BOOLEAN/);
  assert.match(db, /CATEGORY_CATALOG/);
});

test('jobs search contract supports q and taxonomy filters', () => {
  const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
  const jobRoutes = fs.readFileSync(path.join(root, 'backend/src/routes/job_routes.js'), 'utf8');
  const jobHandlers = fs.readFileSync(path.join(root, 'backend/src/routes/job_handlers.js'), 'utf8');
  const repo = fs.readFileSync(path.join(root, 'backend/src/repository/views.js'), 'utf8');
  assert.match(`${jobRoutes}\n${jobHandlers}`, /searchParams\.get\('q'\)/);
  assert.match(repo, /search = null/);
  assert.match(repo, /ILIKE/);
  assert.match(repo, /c\.name_en/);
});
