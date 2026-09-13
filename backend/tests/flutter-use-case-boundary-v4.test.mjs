import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

test('high-traffic Flutter pages use ApplicationRegistry for data access', () => {
  const jobs = read('lib/features/jobs/jobs_page.dart');
  const reset = read('lib/features/auth/password_reset_page.dart');
  const tx = read('lib/features/transactions/transactions_page.dart');
  for (const source of [jobs, reset, tx]) assert.match(source, /ApplicationRegistry/);
  assert.doesNotMatch(jobs, /read<MarketplaceRepository>/);
  assert.doesNotMatch(reset, /read<AuthRepository>/);
  assert.doesNotMatch(tx, /widget\.repository\.listMyJobs/);
});

test('ApplicationRegistry exposes read use cases without exposing ApiClient', () => {
  const registry = read('lib/core/application/application_registry.dart');
  const cases = read('lib/core/application/use_cases.dart');
  for (const token of ['ListCategoriesUseCase', 'ListOpportunitiesUseCase', 'RequestPasswordResetUseCase', 'ListMyJobsUseCase']) {
    assert.match(cases, new RegExp(`class ${token}`));
    assert.match(registry, new RegExp(token));
  }
  assert.doesNotMatch(cases, /ApiClient/);
});
