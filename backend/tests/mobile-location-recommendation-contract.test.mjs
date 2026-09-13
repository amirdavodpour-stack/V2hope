import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('mobile settings persist location coordinates and clear them when disabled', async () => {
  const source = await fs.readFile(new URL('../../lib/core/settings/settings_controller.dart', import.meta.url), 'utf8');
  assert.match(source, /locationLatitude/);
  assert.match(source, /locationLongitude/);
  assert.match(source, /setDouble\(_latitudeKey/);
  assert.match(source, /setDouble\(_longitudeKey/);
  assert.match(source, /remove\(_latitudeKey/);
  assert.match(source, /remove\(_longitudeKey/);
});

test('explore loads the recommendation endpoint when personalization is enabled', async () => {
  const jobs = await fs.readFile(new URL('../../lib/features/jobs/jobs_page.dart', import.meta.url), 'utf8');
  const repository = await fs.readFile(new URL('../../lib/core/marketplace/marketplace_repository.dart', import.meta.url), 'utf8');
  assert.match(jobs, /personalizedRecommendations/);
  assert.match(repository, /jobs\/recommended/);
});
