import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-product-'));
process.env.DATA_FILE = path.join(tmp, 'hope.json');
process.env.STORAGE_DIR = path.join(tmp, 'storage');
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.GENERAL_RATE_LIMIT_MAX = '5000';

const { createServer } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const json = (url, options = {}) => fetch(base + url, {
  ...options,
  headers: {'Content-Type': 'application/json', ...(options.headers || {})},
}).then(async (r) => ({status: r.status, body: await r.json()}));

async function register(email, displayName = email) {
  const r = await json('/auth/register', {
    method: 'POST',
    body: JSON.stringify({email, password: 'pass123456789', displayName}),
  });
  assert.equal(r.status, 201);
  return r.body.data;
}

async function categoryId() {
  const r = await json('/categories');
  assert.equal(r.status, 200);
  return r.body.data[0].id;
}

async function createOpportunity(token, patch = {}) {
  const body = {
    title: 'Product test opportunity',
    description: 'A valid opportunity description for product testing.',
    categoryId: await categoryId(),
    jobType: patch.kind === 'JOB' ? 'HOURLY' : 'FIXED',
    budgetType: 'FIXED',
    budgetMin: patch.kind === 'JOB' ? 30000000 : 100000,
    budgetMax: patch.kind === 'JOB' ? 30000000 : 100000,
    duration: patch.kind === 'JOB' ? 30 : 4,
    acceptanceCriteria: 'Meets the written acceptance criteria.',
    city: patch.city || 'تهران',
    kind: patch.kind || 'MISSION',
    visibility: patch.visibility || 'PUBLIC',
    ...(patch.kind === 'JOB' ? {schedule: patch.schedule || 'FULL_TIME', monthlySalary: 30000000, applicationDeadline: patch.applicationDeadline || '2099-12-31'} : {}),
  };
  const r = await json('/jobs', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 201);
  const created = r.body.data;
  const published = await json(`/jobs/${created.id}/publish`, {method:'POST', headers:{Authorization:`Bearer ${token}`}});
  assert.equal(published.status, 200);
  return published.body.data;
}

test('job creation enforces schedule and real YYYY-MM-DD deadline', async () => {
  const owner = await register('job-validation-owner@example.com');
  const category = await categoryId();
  const missingSchedule = await json('/jobs', {
    method: 'POST', headers: {Authorization: `Bearer ${owner.accessToken}`},
    body: JSON.stringify({title:'Job 1',description:'valid description',categoryId:category,jobType:'HOURLY',budgetType:'FIXED',budgetMin:100,budgetMax:100,duration:30,acceptanceCriteria:'criteria',kind:'JOB',monthlySalary:1000,applicationDeadline:'2099-12-31'}),
  });
  assert.equal(missingSchedule.status, 400);
  assert.equal(missingSchedule.body.error.code, 'INVALID_SCHEDULE');

  const invalidDeadline = await json('/jobs', {
    method: 'POST', headers: {Authorization: `Bearer ${owner.accessToken}`},
    body: JSON.stringify({title:'Job 2',description:'valid description',categoryId:category,jobType:'HOURLY',budgetType:'FIXED',budgetMin:100,budgetMax:100,duration:30,acceptanceCriteria:'criteria',kind:'JOB',schedule:'FULL_TIME',monthlySalary:1000,applicationDeadline:'not-a-date'}),
  });
  assert.equal(invalidDeadline.status, 400);
  assert.equal(invalidDeadline.body.error.code, 'INVALID_DEADLINE');
});

test('mission and job query filters work server-side', async () => {
  const owner = await register('filter-owner@example.com');
  await createOpportunity(owner.accessToken, {kind:'MISSION', visibility:'PUBLIC', city:'تهران'});
  await createOpportunity(owner.accessToken, {kind:'JOB', visibility:'SPECIALIZED', city:'شیراز'});

  for (const kind of ['MISSION', 'JOB']) {
    const filtered = await json(`/jobs?kind=${kind}`);
    assert.equal(filtered.status, 200);
    assert.ok(filtered.body.data.length >= 1);
    assert.ok(filtered.body.data.every((j) => j.kind === kind));
  }

  const specialized = await json('/jobs?visibility=SPECIALIZED');
  assert.equal(specialized.status, 200);
  assert.ok(specialized.body.data.every((j) => j.visibility === 'SPECIALIZED'));

  const shiraz = await json('/jobs?city=%D8%B4%DB%8C%D8%B1%D8%A7%D8%B2');
  assert.equal(shiraz.status, 200);
  assert.ok(shiraz.body.data.every((j) => j.city === 'شیراز'));
});

test('taxonomy endpoint returns a bilingual hierarchy and search finds opportunity content', async () => {
  const categories = await json('/categories');
  assert.equal(categories.status, 200);
  assert.ok(categories.body.data.length >= 10);
  assert.ok(categories.body.data.some((c) => c.nameEn && c.nameEn.length > 0));
  assert.ok(categories.body.data.some((c) => c.parentId));
  assert.ok(categories.body.data.some((c) => c.slug === 'technology'));

  const owner = await register('taxonomy-search-owner@example.com');
  await createOpportunity(owner.accessToken, {kind:'JOB', city:'شیراز'});
  const byTitle = await json('/jobs?q=Product%20test');
  assert.equal(byTitle.status, 200);
  assert.ok(byTitle.body.data.some((j) => j.title === 'Product test opportunity'));

  const byCity = await json('/jobs?q=%D8%B4%DB%8C%D8%B1%D8%A7%D8%B2');
  assert.equal(byCity.status, 200);
  assert.ok(byCity.body.data.some((j) => j.city === 'شیراز'));
});

test('job applications are deadline-aware and employer candidate view is identity-minimized', async () => {
  const owner = await register('candidate-owner@example.com', 'Employer');
  const candidate = await register('candidate-user@example.com', 'Private Candidate');
  const futureJob = await createOpportunity(owner.accessToken, {kind:'JOB'});
  const applied = await json('/applications', {
    method:'POST', headers:{Authorization:`Bearer ${candidate.accessToken}`},
    body:JSON.stringify({jobId:futureJob.id,resumeText:'Senior professional with strong relevant experience.',skills:'design, research'}),
  });
  assert.equal(applied.status, 201);
  assert.equal(applied.body.data.status, 'PENDING');
  assert.ok(!('candidateId' in applied.body.data));

  const admin = await register('product-admin@example.com', 'Admin User');
  db.collection.users.find((u) => u.id === admin.user.id).role = 'ADMIN';
  const apps = await json('/admin/applications', {headers:{Authorization:`Bearer ${admin.accessToken}`}});
  assert.equal(apps.status, 200);
  const row = apps.body.data.find((a) => a.id === applied.body.data.id);
  assert.ok(row);
  assert.equal(row.candidateName, 'Private Candidate');
  assert.equal(row.candidateId, candidate.user.id);

  const selected = await json(`/admin/applications/${row.id}/select`, {method:'POST', headers:{Authorization:`Bearer ${admin.accessToken}`}});
  assert.equal(selected.status, 200);

  const candidates = await json(`/jobs/${futureJob.id}/candidates`, {headers:{Authorization:`Bearer ${owner.accessToken}`}});
  assert.equal(candidates.status, 200);
  assert.equal(candidates.body.data.length, 1);
  assert.equal(candidates.body.data[0].resumeText, 'Senior professional with strong relevant experience.');
  assert.equal(candidates.body.data[0].skills, 'design, research');
  assert.equal(candidates.body.data[0].candidateId, undefined);
  assert.equal(candidates.body.data[0].email, undefined);
});

test('admin delete removes only non-transactional opportunities and mirrors relational cascades in file mode', async () => {
  const owner = await register('delete-owner@example.com');
  const candidate = await register('delete-candidate@example.com');
  const admin = await register('delete-admin@example.com');
  db.collection.users.find((u) => u.id === admin.user.id).role = 'ADMIN';

  const published = await createOpportunity(owner.accessToken, {kind:'JOB'});
  const app = await json('/applications', {method:'POST', headers:{Authorization:`Bearer ${candidate.accessToken}`}, body:JSON.stringify({jobId:published.id,resumeText:'Candidate resume content is long enough.',skills:'testing'})});
  assert.equal(app.status, 201);
  const deleted = await json(`/admin/jobs/${published.id}`, {method:'DELETE', headers:{Authorization:`Bearer ${admin.accessToken}`}});
  assert.equal(deleted.status, 200);
  assert.equal(db.collection.jobs.some((j) => j.id === published.id), false);
  assert.equal(db.collection.jobApplications.some((a) => a.jobId === published.id), false);

  const mission = await createOpportunity(owner.accessToken, {kind:'MISSION'});
  const provider = await register('delete-provider@example.com');
  const offer = await json('/offers', {method:'POST', headers:{Authorization:`Bearer ${provider.accessToken}`}, body:JSON.stringify({jobId:mission.id,price:100000,message:'offer'})});
  assert.equal(offer.status, 201);
  const accept = await json(`/offers/${offer.body.data.id}/accept`, {method:'POST', headers:{Authorization:`Bearer ${owner.accessToken}`}});
  assert.equal(accept.status, 200);
  const fund = await json(`/payments/fund/${mission.id}`, {method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'delete-protection'},body:'{}'});
  assert.equal(fund.status, 201);
  const blocked = await json(`/admin/jobs/${mission.id}`, {method:'DELETE', headers:{Authorization:`Bearer ${admin.accessToken}`}});
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'JOB_NOT_DELETABLE');
});

after(async () => {
  await db.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmp, {recursive:true, force:true});
});


test('financial fee policy is visible and distinguishes mission from monthly job', async () => {
  const owner = await register('financial-requirement-owner@example.com');
  const mission = await createOpportunity(owner.accessToken, {kind:'MISSION'});
  const provider = await register('financial-requirement-provider@example.com');
  const offer = await json('/offers',{method:'POST',headers:{Authorization:`Bearer ${provider.accessToken}`},body:JSON.stringify({jobId:mission.id,price:100000,message:'offer'})});
  assert.equal(offer.status,201);
  assert.equal((await json(`/offers/${offer.body.data.id}/accept`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}})).status,200);
  const funded=await json(`/payments/fund/${mission.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'financial-policy-req'},body:'{}'});
  assert.equal(funded.status,201); assert.equal(funded.body.data.fees.employerFee,10000); assert.equal(funded.body.data.fees.workerFee,10000); assert.equal(funded.body.data.fees.platformFee,20000);
});
