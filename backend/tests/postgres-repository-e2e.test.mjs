import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const enabled = Boolean(process.env.DATABASE_URL);
if (process.env.REQUIRE_INTEGRATION === '1' && !enabled) throw new Error('REQUIRE_INTEGRATION=1 but DATABASE_URL is missing');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-pg-e2e-'));
process.env.NODE_ENV = 'test';
process.env.STORAGE_DIR = path.join(tmp, 'storage');

const { createServer } = await import('../src/app.js');
const { db, getPool } = await import('../src/db.js');

let server = null;
let json = null;

if (enabled) {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  json = (url, options = {}) => fetch(base + url, {
    ...options,
    headers: {'Content-Type': 'application/json', ...(options.headers || {})},
  }).then(async (response) => ({
    status: response.status,
    body: await response.json().catch(() => null),
  }));
}

async function register(email, displayName = email) {
  const response = await json('/auth/register', {
    method: 'POST',
    body: JSON.stringify({email, password:'pass123456789', displayName}),
  });
  assert.equal(response.status, 201);
  return response.body.data;
}

function auth(token, extra = {}) {
  return {Authorization:`Bearer ${token}`, ...extra};
}

test('PostgreSQL repository path executes a complete marketplace/payment lifecycle', {skip: !enabled}, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = await register(`pg-owner-${suffix}@example.test`, 'PG Owner');
  const provider = await register(`pg-provider-${suffix}@example.test`, 'PG Provider');

  const categories = await json('/categories');
  assert.equal(categories.status, 200);
  assert.ok(categories.body.data.length > 0);
  const categoryId = categories.body.data[0].id;

  const createdJob = await json('/jobs', {
    method:'POST',
    headers:auth(owner.accessToken),
    body:JSON.stringify({
      title:'Postgres integration job', description:'Repository integration exercise', categoryId,
      jobType:'FIXED', budgetType:'FIXED', budgetMin:100000, budgetMax:120000, duration:7,
      // schedule is a job-only field; the current contract rejects it on a
      // MISSION (INVALID_KIND_FIELDS). This fixture was stale and carried it.
      acceptanceCriteria:'done', city:'تهران', kind:'MISSION', visibility:'PUBLIC',
    }),
  });
  assert.equal(createdJob.status, 201);
  const job = createdJob.body.data;

  assert.equal((await json(`/jobs/${job.id}/publish`, {method:'POST', headers:auth(owner.accessToken)})).status, 200);

  const offer = await json('/offers', {
    method:'POST',
    headers:auth(provider.accessToken),
    body:JSON.stringify({jobId:job.id, price:110000, message:'ready'}),
  });
  assert.equal(offer.status, 201);
  assert.equal((await json(`/offers/${offer.body.data.id}/accept`, {method:'POST', headers:auth(owner.accessToken)})).status, 200);

  const fund = await json(`/payments/fund/${job.id}`, {
    method:'POST',
    headers:auth(owner.accessToken, {'Idempotency-Key':'pg-fund-1'}),
    body:'{}',
  });
  assert.equal(fund.status, 201);
  assert.equal(fund.body.data.status, 'HELD');
  const replay = await json(`/payments/fund/${job.id}`, {
    method:'POST',
    headers:auth(owner.accessToken, {'Idempotency-Key':'pg-fund-1'}),
    body:'{}',
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.id, fund.body.data.id);

  assert.equal((await json(`/jobs/${job.id}/start`, {method:'POST', headers:auth(provider.accessToken)})).status, 200);
  assert.equal((await json(`/jobs/${job.id}/evidence`, {method:'POST', headers:auth(provider.accessToken), body:JSON.stringify({uri:'https://example.test/evidence'})})).status, 201);
  assert.equal((await json(`/jobs/${job.id}/deliver`, {method:'POST', headers:auth(provider.accessToken)})).status, 200);
  assert.equal((await json(`/jobs/${job.id}/accept`, {method:'POST', headers:auth(owner.accessToken)})).status, 200);
  // Settlement is dispatched through the outbox for exactly-once processing
  // (lease token + retry + recovery). The route acknowledges the dispatch
  // with 202 + settlement.status=PENDING whenever the worker does not drain
  // the release within the request; production completes it via the
  // background outbox worker. The test drives the worker directly until the
  // settlement commits, then asserts the terminal state (payment RELEASED,
  // job SETTLED, ledger balanced) so the validation is not weakened.
  const release = await json(`/payments/release/${job.id}`, {method:'POST', headers:auth(owner.accessToken)});
  assert.ok([200, 202].includes(release.status), `release ack must be 200 or 202, got ${release.status}`);
  if (release.status === 202) {
    assert.equal(release.body.data.settlement.status, 'PENDING');
    const { processPaymentReleaseNow } = await import('../src/outbox_worker.js');
    for (let attempt = 0; attempt < 25; attempt++) {
      await processPaymentReleaseNow();
      const refreshed = await json(`/payments/jobs/${job.id}`, {headers:auth(owner.accessToken)});
      if (refreshed.status === 200 && refreshed.body?.data?.status === 'RELEASED') break;
    }
  }
  const finalPayment = await json(`/payments/jobs/${job.id}`, {headers:auth(owner.accessToken)});
  assert.equal(finalPayment.status, 200);
  assert.equal(finalPayment.body.data.status, 'RELEASED');

  const pool = getPool();
  const paymentRows = await pool.query('SELECT status, idempotency_key FROM payments WHERE id=$1', [fund.body.data.id]);
  assert.equal(paymentRows.rows[0].status, 'RELEASED');
  assert.equal(paymentRows.rows[0].idempotency_key, 'pg-fund-1');
  const jobRow = await pool.query('SELECT status, provider_id FROM jobs WHERE id=$1', [job.id]);
  assert.equal(jobRow.rows[0].status, 'SETTLED');
  assert.equal(jobRow.rows[0].provider_id, provider.user.id);
  const ledger = await pool.query('SELECT COALESCE(SUM(debit),0)::numeric AS debits, COALESCE(SUM(credit),0)::numeric AS credits FROM ledger_entries WHERE reference_id=$1', [fund.body.data.id]);
  assert.equal(Number(ledger.rows[0].debits), Number(ledger.rows[0].credits));

  const applications = await json('/applications', {headers:auth(provider.accessToken)});
  assert.equal(applications.status, 200);
});

after(async () => {
  if (server) {
    await db.close();
    await new Promise((resolve) => server.close(resolve));
  }
  fs.rmSync(tmp, {recursive:true, force:true});
});
