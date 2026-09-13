import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const registry=fs.readFileSync(new URL('../../lib/core/application/application_registry.dart',import.meta.url),'utf8');
const repo=fs.readFileSync(new URL('../../lib/core/marketplace/saved_search_repository.dart',import.meta.url),'utf8');
const jobs=fs.readFileSync(new URL('../../lib/features/jobs/jobs_page.dart',import.meta.url),'utf8');
const filter=fs.readFileSync(new URL('../../lib/features/jobs/jobs_filter_bar.part.dart',import.meta.url),'utf8');
test('V2 saved-search repository is bounded and recoverable',()=>{assert.match(registry,/SavedSearchRepository/);assert.match(repo,/SharedPreferencesSavedSearchRepository/);assert.match(repo,/static const _limit = 20/);assert.match(repo,/jsonDecode\(raw\)/);assert.match(repo,/prefs\.remove\(_key\)/);});
test('V2 discovery exposes save restore delete controls',()=>{assert.match(jobs,/_saveCurrentSearch/);assert.match(jobs,/_openSavedSearches/);assert.match(jobs,/savedSearches\.upsert/);assert.match(jobs,/savedSearches\.delete/);assert.match(filter,/Save search/);});
