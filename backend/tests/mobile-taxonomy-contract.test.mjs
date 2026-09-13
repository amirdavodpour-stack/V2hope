import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname, '..');

test('mobile startup restores authentication before rendering the router', () => {
  const main = fs.readFileSync(path.join(root, 'lib/main.dart'), 'utf8');
  assert.match(main, /final authRepository = ApiAuthRepository\(api\);/);
  assert.match(main, /final auth = AuthController\(authRepository, store\);/);
  assert.match(main, /await auth\.restoreSession\(\);/);
  assert.match(main, /const AppRouter\(\)/);
  assert.doesNotMatch(main, /AppRouter\(api:/);
});

test('mobile marketplace consumes hierarchical API categories instead of a hardcoded text field', () => {
  const create = fs.readFileSync(path.join(root, 'lib/features/marketplace/create_job_page.dart'), 'utf8');
  const jobs = fs.readFileSync(path.join(root, 'lib/features/jobs/jobs_page.dart'), 'utf8');
  const category = fs.readFileSync(path.join(root, 'lib/core/marketplace/category.dart'), 'utf8');
  assert.match(create, /ApplicationRegistry/);
  assert.match(create, /createOpportunity/);
  assert.match(create, /listCategories/);
  assert.doesNotMatch(create, /MarketplaceRepository/);
  assert.match(create, /DropdownButtonFormField<String>/);
  assert.doesNotMatch(create, /TextField\(controller:cat/);
  assert.match(jobs, /ApplicationRegistry/);
  assert.match(jobs, /listCategories/);
  assert.match(jobs, /listOpportunities/);
  assert.match(category, /parentId/);
  assert.match(category, /flattenCategories/);
});
