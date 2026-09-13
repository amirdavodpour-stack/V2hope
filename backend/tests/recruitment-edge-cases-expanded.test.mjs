import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-recruitment-delta-');
const api = await startApiServer();
function auth(token) { return {Authorization: `Bearer ${token}`}; }

async function categoryId() { return (await api.json('/categories')).body.data[0].id; }

async function createJob(owner, extra = {}) {
  const payload = {
    title: 'Recruitment job', description: 'Build a useful product', categoryId: await categoryId(),
    jobType: 'HOURLY', budgetType: 'FIXED', budgetMin: 10000000, budgetMax: 10000000,
    duration: 30, acceptanceCriteria: 'Complete', city: 'Tehran', kind: 'JOB',
    visibility: 'PUBLIC', schedule: 'FULL_TIME', monthlySalary: 10000000,
    applicationDeadline: '2099-12-31', ...extra,
  };
  const r = await api.json('/jobs', {method: 'POST', headers: auth(owner.accessToken), body: JSON.stringify(payload)});
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const p = await api.json(`/jobs/${r.body.data.id}/publish`, {method: 'POST', headers: auth(owner.accessToken)});
  assert.equal(p.status, 200, JSON.stringify(p.body));
  return p.body.data;
}

test('job creation rejects reversed budgets and impossible calendar dates', async () => {
  const owner = await register(api.json, 'recruit-validation@example.com');
  const reversed = await api.json('/jobs', {method: 'POST', headers: auth(owner.accessToken), body: JSON.stringify({
    title: 'Valid title', description: 'Valid description', categoryId: await categoryId(), jobType: 'HOURLY', budgetType: 'RANGE', budgetMin: 20, budgetMax: 10,
    duration: 1, acceptanceCriteria: 'Complete the work', city: 'Tehran', kind: 'JOB', visibility: 'PUBLIC', schedule: 'FULL_TIME', monthlySalary: 100,
    applicationDeadline: '2099-12-31',
  })});
  assert.equal(reversed.status, 400);
  assert.equal(reversed.body.error.code, 'INVALID_BUDGET');

  const badDate = await api.json('/jobs', {method: 'POST', headers: auth(owner.accessToken), body: JSON.stringify({
    title: 'Valid title', description: 'Valid description', categoryId: await categoryId(), jobType: 'HOURLY', budgetType: 'FIXED', budgetMin: 10, budgetMax: 10,
    duration: 1, acceptanceCriteria: 'Complete the work', city: 'Tehran', kind: 'JOB', visibility: 'PUBLIC', schedule: 'FULL_TIME', monthlySalary: 100,
    applicationDeadline: '2026-02-30',
  })});
  assert.equal(badDate.status, 400);
  assert.equal(badDate.body.error.code, 'INVALID_DEADLINE');
});

test('candidate lifecycle blocks illegal jumps and permits only the staged progression', async () => {
  const owner = await register(api.json, 'recruit-owner@example.com');
  const candidate = await register(api.json, 'recruit-candidate@example.com');
  const job = await createJob(owner);

  const app = await api.json('/applications', {method: 'POST', headers: auth(candidate.accessToken), body: JSON.stringify({jobId: job.id, resumeText: 'Five years of practical engineering experience', skills: 'javascript node'})});
  assert.equal(app.status, 201);

  const illegalHire = await api.json(`/jobs/${job.id}/candidates/${app.body.data.id}/hire`, {method: 'POST', headers: auth(owner.accessToken)});
  assert.equal(illegalHire.status, 409);
  assert.equal(illegalHire.body.error.code, 'INVALID_APPLICATION_STATE');

  const shortlist = await api.json(`/admin/applications/${app.body.data.id}/shortlist`, {method: 'POST', headers: auth(owner.accessToken)});
  assert.equal(shortlist.status, 403);
});

test('candidate withdrawal is candidate-only and terminal once withdrawn', async () => {
  const owner = await register(api.json, 'withdraw-owner@example.com');
  const candidate = await register(api.json, 'withdraw-candidate@example.com');
  const outsider = await register(api.json, 'withdraw-outsider@example.com');
  const job = await createJob(owner);
  const app = await api.json('/applications', {method: 'POST', headers: auth(candidate.accessToken), body: JSON.stringify({jobId: job.id, resumeText: 'A sufficiently long candidate resume for validation', skills: 'dart flutter'})});
  assert.equal(app.status, 201);

  const outsiderWithdraw = await api.json(`/applications/${app.body.data.id}/withdraw`, {method: 'POST', headers: auth(outsider.accessToken)});
  assert.equal(outsiderWithdraw.status, 409);
  assert.equal(outsiderWithdraw.body.error.code, 'INVALID_APPLICATION_STATE');

  const withdrawn = await api.json(`/applications/${app.body.data.id}/withdraw`, {method: 'POST', headers: auth(candidate.accessToken)});
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.data.status, 'WITHDRAWN');

  const twice = await api.json(`/applications/${app.body.data.id}/withdraw`, {method: 'POST', headers: auth(candidate.accessToken)});
  assert.equal(twice.status, 409);
  assert.equal(twice.body.error.code, 'INVALID_APPLICATION_STATE');
});

test('provider profile creation is safe and does not leak password hashes', async () => {
  const user = await register(api.json, 'provider-profile@example.com');
  const r = await api.json('/providers/me', {headers: auth(user.accessToken)});
  assert.equal(r.status, 200);
  assert.equal(r.body.data.user.id, user.user.id);
  assert.equal(r.body.data.user.email, undefined);
  assert.equal(r.body.data.passwordHash, undefined);
});

after(async () => closeApi({...api, tmp}));
