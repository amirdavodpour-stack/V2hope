import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const repo = fs.readFileSync(path.join(root, 'lib/core/marketplace/marketplace_repository.dart'), 'utf8');
const main = fs.readFileSync(path.join(root, 'lib/main.dart'), 'utf8');

test('offline marketplace cache is read-through and stale-tolerant', () => {
  assert.match(repo, /class OfflineMarketplaceRepository implements MarketplaceRepository/);
  assert.match(repo, /freshFor = const Duration\(minutes: 5\)/);
  assert.match(repo, /staleFor = const Duration\(hours: 24\)/);
  assert.match(repo, /catch \(\_\) \{\s*final cached = await _readJobs/);
  assert.match(repo, /Future<HopeJob> createOpportunity\(Map<String, dynamic> body\) async/);
  assert.match(repo, /maxCachedEntries = 30/);
  assert.match(repo, /hope\.v2\.cache\.index/);
  assert.match(repo, /while \(ordered\.length > maxCachedEntries\)/);
  assert.match(repo, /Future<void> _removeCachedKey/);
  assert.match(repo, /Personalized results are user-specific/);
  assert.match(repo, /if \(personalizedRecommendations\) \{\s*return _remote\.listOpportunities/);
  assert.match(repo, /_invalidateOpportunityListCaches/);
});

test('production marketplace provider uses offline decorator', () => {
  assert.match(main, /OfflineMarketplaceRepository\(ApiMarketplaceRepository\(api\)\)/);
});
