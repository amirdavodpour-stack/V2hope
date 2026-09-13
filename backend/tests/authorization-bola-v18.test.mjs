import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-authz-bola-v18-');
const api = await startApiServer();

function auth(token) { return { Authorization: `Bearer ${token}` }; }

async function createJob(ownerToken, categoryId, title) {
  const r = await api.json('/jobs', {
    method: 'POST', headers: auth(ownerToken),
    body: JSON.stringify({
      title, description: 'A sufficiently detailed job', categoryId,
      jobType: 'HOURLY', budgetType: 'FIXED', budgetMin: 100, budgetMax: 200,
      duration: 30, acceptanceCriteria: 'Complete the agreed work',
      kind: 'JOB', schedule: 'FULL_TIME', monthlySalary: 150, applicationDeadline: '2099-12-31',
    }),
  });
  assert.equal(r.status, 201);
  const p = await api.json(`/jobs/${r.body.data.id}/publish`, { method: 'POST', headers: auth(ownerToken) });
  assert.equal(p.status, 200);
  return p.body.data;
}

test('application lifecycle endpoint is scoped to the route job, not only application owner', async () => {
  const owner = await register(api.json, 'bola-owner-v18@example.com', 'Owner');
  const candidate = await register(api.json, 'bola-candidate-v18@example.com', 'Candidate');
  const categoryId = (await api.json('/categories')).body.data[0].id;

  const jobA = await createJob(owner.accessToken, categoryId, 'BOLA job A');
  const jobB = await createJob(owner.accessToken, categoryId, 'BOLA job B');

  const application = await api.json('/applications', {
    method: 'POST', headers: auth(candidate.accessToken),
    body: JSON.stringify({ jobId: jobA.id, resumeText: 'This is a sufficiently long resume for testing.', skills: 'testing' }),
  });
  assert.equal(application.status, 201);
  const applicationId = application.body.data.id;

  // Promote a test account to admin, then forward the application for job A.
  const ownerRow = api.db.collection.users.find((u) => u.id === owner.user.id);
  ownerRow.role = 'ADMIN';
  ownerRow.sessionVersion += 1;
  await api.db.save();
  const login = await api.json('/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'bola-owner-v18@example.com', password: 'pass123456789' }),
  });
  assert.equal(login.status, 200);

  const forward = await api.json(`/admin/applications/${applicationId}/select`, {
    method: 'POST', headers: auth(login.body.data.accessToken),
  });
  assert.equal(forward.status, 200);
  assert.equal(forward.body.data.status, 'FORWARDED');

  // Same owner controls both jobs, so an owner-only check is not sufficient.
  // The application must also belong to the specific :jobId in the URL.
  const wrongJobInterview = await api.json(`/jobs/${jobB.id}/candidates/${applicationId}/interview`, {
    method: 'POST', headers: auth(login.body.data.accessToken),
  });
  assert.equal(wrongJobInterview.status, 409);
  assert.equal(wrongJobInterview.body.error.code, 'APPLICATION_JOB_MISMATCH');

  // The application on job A is untouched by the rejected cross-job request.
  assert.equal(api.db.collection.jobApplications.find((a) => a.id === applicationId).status, 'FORWARDED');
});

test('PostgreSQL employer application transition contract accepts expected job scope', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../src/repository/applications.js', import.meta.url), 'utf8');
  assert.match(source, /transitionEmployerApplication\(id, ownerId, fromStatuses, toStatus, expectedJobId = null\)/);
  assert.match(source, /job\.id!==expectedJobId/);
});

after(async () => closeApi({ ...api, tmp }));
