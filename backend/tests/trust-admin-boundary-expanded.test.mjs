import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-trust-admin-delta-');
const api = await startApiServer();
function auth(token) { return {Authorization: `Bearer ${token}`}; }
async function categoryId() { return (await api.json('/categories')).body.data[0].id; }
async function createJob(owner) {
  const r = await api.json('/jobs', {method:'POST', headers:auth(owner.accessToken), body:JSON.stringify({
    title:'Reportable job', description:'A sufficiently descriptive job for trust testing', categoryId:await categoryId(),
    jobType:'HOURLY', budgetType:'FIXED', budgetMin:100, budgetMax:100, duration:5,
    acceptanceCriteria:'Complete the agreed work', city:'Tehran', kind:'JOB', visibility:'PUBLIC', schedule:'FULL_TIME', monthlySalary:100,
    applicationDeadline:'2099-12-31',
  })});
  assert.equal(r.status, 201);
  return r.body.data;
}
async function makeAdmin() {
  const admin = await register(api.json, 'trust-admin@example.com', 'Trust Admin');
  const row = api.db.collection.users.find((x) => x.id === admin.user.id);
  row.role = 'ADMIN'; row.sessionVersion += 1; await api.db.save();
  const login = await api.json('/auth/login', {method:'POST', body:JSON.stringify({email:'trust-admin@example.com', password:'pass123456789'})});
  assert.equal(login.status, 200);
  return login.body.data;
}

test('job reports are owner-independent, stored as OPEN, and scoped to the reported job', async () => {
  const owner = await register(api.json, 'trust-owner@example.com');
  const reporter = await register(api.json, 'trust-reporter@example.com');
  const job = await createJob(owner);
  const r = await api.json(`/jobs/${job.id}/report`, {method:'POST', headers:auth(reporter.accessToken), body:JSON.stringify({reason:'Spam listing', details:'Repeatedly misleading description'})});
  assert.equal(r.status, 201);
  assert.equal(r.body.data.status, 'OPEN');
  const stored = api.db.collection.trustReports.find((x) => x.id === r.body.data.id);
  assert.equal(stored.reporterId, reporter.user.id);
  assert.equal(stored.entityType, 'JOB');
  assert.equal(stored.entityId, job.id);
});

test('non-admin users cannot enumerate or mutate trust reports', async () => {
  const user = await register(api.json, 'trust-nonadmin@example.com');
  const deniedList = await api.json('/admin/trust-reports', {headers:auth(user.accessToken)});
  assert.equal(deniedList.status, 403);
  const deniedUpdate = await api.json('/admin/trust-reports/nope/status', {method:'POST', headers:auth(user.accessToken), body:JSON.stringify({status:'RESOLVED'})});
  assert.equal(deniedUpdate.status, 403);
});

test('admin trust status changes are enum-constrained and auditable', async () => {
  const owner = await register(api.json, 'trust-audit-owner@example.com');
  const reporter = await register(api.json, 'trust-audit-reporter@example.com');
  const job = await createJob(owner);
  const created = await api.json(`/jobs/${job.id}/report`, {method:'POST', headers:auth(reporter.accessToken), body:JSON.stringify({reason:'Fraud', details:'Please review'})});
  const admin = await makeAdmin();

  const invalid = await api.json(`/admin/trust-reports/${created.body.data.id}/status`, {method:'POST', headers:auth(admin.accessToken), body:JSON.stringify({status:'BANNED'})});
  assert.equal(invalid.status, 400);

  const updated = await api.json(`/admin/trust-reports/${created.body.data.id}/status`, {method:'POST', headers:auth(admin.accessToken), body:JSON.stringify({status:'REVIEWING'})});
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.status, 'REVIEWING');
  const audit = api.db.collection.audit.find((x) => x.action === 'TRUST_REPORT_STATUS' && x.entityId === created.body.data.id);
  assert.ok(audit);
  assert.equal(audit.meta.status, 'REVIEWING');
});

after(async () => closeApi({...api, tmp}));
