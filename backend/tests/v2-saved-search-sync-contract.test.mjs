import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

test('saved-search sync endpoint is authenticated, bounded and user-isolated', async () => {
  const tmp = makeTempEnv('hope-saved-search-sync-');
  const api = await startApiServer();
  try {
    const alice = await register(api.json, 'alice-saved-search@example.com');
    const bob = await register(api.json, 'bob-saved-search@example.com');
    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    let r = await api.json('/saved-searches', { headers: auth(alice.accessToken) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.items, []);

    r = await api.json('/saved-searches', {
      method: 'PUT',
      headers: auth(alice.accessToken),
      body: JSON.stringify({ id: 'search-alice-1', name: 'Flutter', query: 'flutter', kind: 'JOB', visibility: 'PUBLIC', city: 'تهران', category: 'tech' }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.name, 'Flutter');

    r = await api.json('/saved-searches', { headers: auth(bob.accessToken) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.items, []);

    r = await api.json('/saved-searches', { headers: auth(alice.accessToken) });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.items.length, 1);
    assert.equal(r.body.data.items[0].query, 'flutter');

    r = await api.json('/saved-searches', {
      method: 'PUT',
      headers: auth(alice.accessToken),
      body: JSON.stringify({ id: 'search-alice-1', name: 'Flutter', query: 'dart', kind: 'JOB', visibility: 'PUBLIC', city: 'شیراز', category: 'tech' }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.query, 'dart');

    r = await api.json('/saved-searches/search-alice-1', {
      method: 'DELETE',
      headers: auth(bob.accessToken),
    });
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'SAVED_SEARCH_NOT_FOUND');

    r = await api.json('/saved-searches/search-alice-1', {
      method: 'DELETE',
      headers: auth(alice.accessToken),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.deleted, true);
  } finally {
    await closeApi({ ...api, tmp });
  }
});

test('saved-search route rejects oversized or malformed names', async () => {
  const tmp = makeTempEnv('hope-saved-search-validation-');
  const api = await startApiServer();
  try {
    const user = await register(api.json, 'saved-search-validation@example.com');
    const auth = { Authorization: `Bearer ${user.accessToken}` };
    const longName = 'x'.repeat(101);
    let r = await api.json('/saved-searches', { method: 'PUT', headers: auth, body: JSON.stringify({ name: longName }) });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'INVALID_FIELD');
  } finally {
    await closeApi({ ...api, tmp });
  }
});


test('mobile saved-search sync persists pending upserts and tombstones for offline convergence', async () => {
  const mobile = new URL('../../lib/core/marketplace/saved_search_repository.dart', import.meta.url).pathname;
  const source = await (await import('node:fs/promises')).readFile(mobile, 'utf8');
  assert.match(source, /pending_upserts/);
  assert.match(source, /pending_deletes/);
  assert.match(source, /_flushPending\(\)/);
  assert.match(source, /deletes\.add\(id\)/);
  assert.match(source, /remainingDeletes/);
  assert.match(source, /\.where\(\(item\) => !remainingDeletes\.contains\(item\.id\)\)/);
});
