import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-verticals-'));
if (!process.env.DATABASE_URL) process.env.DATA_FILE = path.join(tmp, 'hope.json');
process.env.STORAGE_DIR = path.join(tmp, 'storage');
process.env.NODE_ENV = 'test';

const { createServer } = await import('../src/app.js');
const { verticalFromRow } = await import('../src/repository/mappers.js');
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const get = (url) => fetch(base + url).then(async (r) => ({ status: r.status, body: await r.json() }));

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('verticalFromRow maps snake_case rows to the API shape', () => {
  const v = verticalFromRow({ id: 'v1', slug: 'jobs', name: 'Jobs', name_en: 'Jobs', description: 'd', config: { a: 1 }, is_active: true, sort_order: '0' });
  assert.deepEqual(v, { id: 'v1', slug: 'jobs', name: 'Jobs', nameEn: 'Jobs', description: 'd', config: { a: 1 }, isActive: true, sortOrder: 0 });
  const sparse = verticalFromRow({ id: 'v2', slug: 's', name: 'S' });
  assert.equal(sparse.nameEn, '');
  assert.deepEqual(sparse.config, {});
  assert.equal(sparse.isActive, true);
  assert.equal(sparse.sortOrder, 0);
});

test('GET /verticals returns the active vertical registry', async () => {
  const r = await get('/verticals');
  assert.equal(r.status, 200);
  const list = r.body.data ?? r.body;
  assert.ok(Array.isArray(list) && list.length >= 1);
  const jobs = list.find((v) => v.slug === 'jobs');
  assert.ok(jobs, 'jobs vertical must be present');
  assert.equal(jobs.isActive, true);
  assert.ok('config' in jobs);
});

test('POST /verticals is rejected (read-only registry)', async () => {
  const r = await fetch(`${base}/verticals`, { method: 'POST' });
  assert.equal(r.status, 405);
});

test('GET /categories without the vertical param behaves exactly as before', async () => {
  const r = await get('/categories');
  assert.equal(r.status, 200);
  const list = r.body.data ?? r.body;
  assert.ok(Array.isArray(list) && list.length > 0, 'legacy jobs taxonomy must keep returning categories');
  assert.ok('parentId' in list[0] && 'sortOrder' in list[0]);
});

test('GET /categories?vertical=jobs matches the unfiltered jobs taxonomy', async () => {
  const all = await get('/categories');
  const jobs = await get('/categories?vertical=jobs');
  assert.equal(jobs.status, 200);
  assert.deepEqual(jobs.body.data ?? jobs.body, all.body.data ?? all.body);
});

test('GET /categories with an unknown vertical returns an empty list, not an error', async () => {
  const r = await get('/categories?vertical=delivery');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data ?? r.body, []);
});

test('GET /categories rejects a malformed vertical slug', async () => {
  const r = await get('/categories?vertical=' + encodeURIComponent('bad slug!'));
  assert.equal(r.status, 400);
});
