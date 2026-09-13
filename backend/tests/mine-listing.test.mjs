import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// GET /jobs/mine had no coverage anywhere in the suite before this file.
// It specifically exercises the jobView()/paymentView() "resolved" owner/
// provider/category fast path added for the listing perf fix -- including
// the nested paymentView() -> jobView(job, null, undefined, resolved) call
// for jobs that already have a payment attached, which is the one part of
// that refactor no other e2e test happens to touch.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-mine-'));
if (!process.env.DATABASE_URL) process.env.DATA_FILE = path.join(tmp, 'hope.json');
process.env.STORAGE_DIR = path.join(tmp, 'storage');
process.env.NODE_ENV = 'test';
const { createServer } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const json = (url, options = {}) =>
  fetch(base + url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
    .then(async (r) => ({ status: r.status, body: await r.json() }));

test('GET /jobs/mine resolves owner, provider, category, offerCount, and a nested funded transaction correctly for both sides', async () => {
  const owner = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'mine-owner@example.com', password: 'pass123456789', displayName: 'Mine Owner' }) })).body.data;
  const provider = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'mine-provider@example.com', password: 'pass123456789', displayName: 'Mine Provider' }) })).body.data;
  const categoryId = (await json('/categories')).body.data[0].id;

  const created = await json('/jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.accessToken}` },
    body: JSON.stringify({ title: 'Mine listing job', description: 'desc', categoryId, jobType: 'FIXED', budgetType: 'FIXED', budgetMin: 50, budgetMax: 75, duration: 2, acceptanceCriteria: 'done' }),
  });
  assert.equal(created.status, 201);
  const jobId = created.body.data.id;

  assert.equal((await json(`/jobs/${jobId}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 200);

  const offer = await json('/offers', { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` }, body: JSON.stringify({ jobId, price: 60, message: 'bid' }) });
  assert.equal(offer.status, 201);
  assert.equal((await json(`/offers/${offer.body.data.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 200);
  assert.equal((await json(`/payments/fund/${jobId}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` }, body: '{}' })).status, 201);

  // Owner's side: offerCount must reflect the one offer submitted, owner/
  // provider must be the correctly-shaped public view (no email leak), and
  // the nested funded transaction's own job snapshot must be resolved too.
  const ownerMine = await json('/jobs/mine', { headers: { Authorization: `Bearer ${owner.accessToken}` } });
  assert.equal(ownerMine.status, 200);
  const ownerItem = ownerMine.body.data.find((j) => j.id === jobId);
  assert.ok(ownerItem, 'funded job must appear in the owner\'s /jobs/mine listing');
  assert.equal(ownerItem.owner.displayName, 'Mine Owner');
  assert.equal(ownerItem.owner.email, undefined);
  assert.equal(ownerItem.provider.displayName, 'Mine Provider');
  assert.equal(ownerItem.category, 'string' === typeof ownerItem.category ? ownerItem.category : null);
  assert.equal(typeof ownerItem.category, 'string');
  assert.equal(ownerItem.offerCount, 1);
  assert.equal(ownerItem.isOwner, true);
  assert.ok(ownerItem.transaction, 'funded job must carry a transaction in /jobs/mine');
  assert.equal(ownerItem.transaction.status, 'HELD');
  assert.equal(ownerItem.transaction.job.id, jobId);
  assert.equal(ownerItem.transaction.job.owner.displayName, 'Mine Owner');
  assert.equal(ownerItem.transaction.job.provider.displayName, 'Mine Provider');
  assert.equal(typeof ownerItem.transaction.job.category, 'string');
  // paymentView() always calls jobView(job, null, ...): isOwner must be false
  // in the nested snapshot regardless of who's asking, matching pre-refactor behavior.
  assert.equal(ownerItem.transaction.job.isOwner, false);

  // Provider's side: same job must appear via the owner_id OR provider_id
  // clause, with isOwner correctly false and the same resolved data.
  const providerMine = await json('/jobs/mine', { headers: { Authorization: `Bearer ${provider.accessToken}` } });
  assert.equal(providerMine.status, 200);
  const providerItem = providerMine.body.data.find((j) => j.id === jobId);
  assert.ok(providerItem, 'funded job must appear in the provider\'s /jobs/mine listing');
  assert.equal(providerItem.isOwner, false);
  assert.equal(providerItem.owner.displayName, 'Mine Owner');
  assert.equal(providerItem.provider.displayName, 'Mine Provider');
  assert.ok(providerItem.transaction);
  assert.equal(providerItem.transaction.job.owner.displayName, 'Mine Owner');
});

after(async () => {
  await db.close();
  await new Promise((r) => server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});
