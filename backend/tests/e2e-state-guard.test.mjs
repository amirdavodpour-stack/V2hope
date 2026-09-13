import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-state-'));
process.env.DATA_FILE = path.join(tmp, 'hope.json');
process.env.STORAGE_DIR = path.join(tmp, 'storage');
process.env.NODE_ENV = 'test';
const { createServer } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const json = (url, options = {}) => fetch(base + url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }).then(async (r) => ({ status: r.status, body: await r.json() }));

test('every lifecycle action is rejected when the job is in the wrong state', async () => {
  const owner = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'state-owner@example.com', password: 'pass123456789', displayName: 'Owner' }) })).body.data;
  const provider = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'state-provider@example.com', password: 'pass123456789', displayName: 'Provider' }) })).body.data;
  const category = (await json('/categories')).body.data[0].id;

  const jobRes = await json('/jobs', { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` }, body: JSON.stringify({ title: 'State test job', description: 'Do it', categoryId: category, jobType: 'FIXED', budgetType: 'FIXED', budgetMin: 100, budgetMax: 150, duration: 3, acceptanceCriteria: 'done' }) });
  const job = jobRes.body.data;

  // DRAFT: cannot fund before publishing, or accept delivery before any exists.
  assert.equal((await json(`/payments/fund/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}`, 'Idempotency-Key': 'state-1' }, body: '{}' })).status, 409);
  assert.equal((await json(`/jobs/${job.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);
  // Cannot publish twice.
  assert.equal((await json(`/jobs/${job.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 200);
  assert.equal((await json(`/jobs/${job.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);

  const offer = (await json('/offers', { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` }, body: JSON.stringify({ jobId: job.id, price: 120, message: 'bid' }) })).body.data;
  assert.equal((await json(`/offers/${offer.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 200);

  // ASSIGNED (not yet funded, but providerId is now set): cannot start work before funding.
  assert.equal((await json(`/jobs/${job.id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` } })).status, 409);
  assert.equal((await json(`/jobs/${job.id}/deliver`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` } })).status, 409);

  assert.equal((await json(`/payments/fund/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}`, 'Idempotency-Key': 'state-2' }, body: '{}' })).status, 201);

  // FUNDED (not yet started): cannot deliver or accept-delivery before starting.
  assert.equal((await json(`/jobs/${job.id}/deliver`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` } })).status, 409);
  assert.equal((await json(`/jobs/${job.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);
  // Cannot release payment before work is even complete.
  assert.equal((await json(`/payments/release/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);

  assert.equal((await json(`/jobs/${job.id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` } })).status, 200);

  // IN_PROGRESS: cannot accept-delivery before it's delivered; cannot release before completion.
  assert.equal((await json(`/jobs/${job.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);
  assert.equal((await json(`/payments/release/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);

  assert.equal((await json(`/jobs/${job.id}/deliver`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` } })).status, 200);

  // DELIVERED: cannot release before the owner accepts delivery.
  assert.equal((await json(`/payments/release/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);

  assert.equal((await json(`/jobs/${job.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 200);
  assert.equal((await json(`/payments/release/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 200);

  // SETTLED: fully terminal, nothing further is allowed.
  assert.equal((await json(`/payments/release/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } })).status, 409);
});

after(async () => { await db.close(); await new Promise((r) => server.close(r)); fs.rmSync(tmp, { recursive: true, force: true }); });
