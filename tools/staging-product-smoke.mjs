import assert from 'node:assert/strict';

const base = String(process.env.STAGING_BASE_URL || '').replace(/\/$/, '');
assert.ok(base.startsWith('https://'), 'STAGING_BASE_URL must use HTTPS.');

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ownerEmail = `staging-owner-${stamp}@example.invalid`;
const providerEmail = `staging-provider-${stamp}@example.invalid`;
const password = process.env.STAGING_PRODUCT_PASSWORD || `Staging-${stamp}-Aa1!`;

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { accept: 'application/json', 'content-type': 'application/json', ...(options.headers || {}) },
  });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { response, body };
}

function expectStatus(result, expected, label) {
  assert.equal(result.response.status, expected, `${label}: expected ${expected}, got ${result.response.status}; body=${JSON.stringify(result.body)}`);
  return result.body?.data ?? result.body;
}

async function poll(label, fn, predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.fail(`${label} timed out: ${JSON.stringify(last)}`);
}

const register = (email, displayName) => request('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, displayName }),
});

const ownerRegistration = await register(ownerEmail, 'Staging Owner');
const owner = expectStatus(ownerRegistration, 201, 'owner registration');
assert.ok(owner.accessToken, 'owner access token missing');

const providerRegistration = await register(providerEmail, 'Staging Provider');
const provider = expectStatus(providerRegistration, 201, 'provider registration');
assert.ok(provider.accessToken, 'provider access token missing');

const categories = await request('/categories');
const categoryList = expectStatus(categories, 200, 'categories');
assert.ok(Array.isArray(categoryList) && categoryList.length > 0, 'no staging categories available');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const jobResult = await request('/jobs', {
  method: 'POST',
  headers: auth(owner.accessToken),
  body: JSON.stringify({
    title: `Staging product smoke ${stamp}`,
    description: 'Automated staging workflow verification',
    categoryId: categoryList[0].id,
    jobType: 'FIXED',
    budgetType: 'FIXED',
    budgetMin: 100,
    budgetMax: 150,
    duration: 3,
    acceptanceCriteria: 'Automated staging verification',
  }),
});
const job = expectStatus(jobResult, 201, 'job creation');

expectStatus(await request(`/api/v1/jobs/${job.id}/publish`, { method: 'POST', headers: auth(owner.accessToken) }), 200, 'job publish');

const offerResult = await request('/offers', {
  method: 'POST',
  headers: auth(provider.accessToken),
  body: JSON.stringify({ jobId: job.id, price: 120, message: 'Staging smoke offer' }),
});
const offer = expectStatus(offerResult, 201, 'offer creation');

expectStatus(await request(`/api/v1/offers/${offer.id}/accept`, { method: 'POST', headers: auth(owner.accessToken) }), 200, 'offer acceptance');

const fundResult = await request(`/api/v1/payments/fund/${job.id}`, {
  method: 'POST',
  headers: { ...auth(owner.accessToken), 'Idempotency-Key': `staging-smoke-${stamp}` },
  body: '{}',
});
assert.ok([200, 201, 202].includes(fundResult.response.status), `payment funding: expected 200/201/202, got ${fundResult.response.status}; body=${JSON.stringify(fundResult.body)}`);
await poll('payment hold', () => request(`/api/v1/payments/jobs/${job.id}`, { headers: auth(owner.accessToken) }), (result) => result.response.status === 200 && (result.body?.data?.status ?? result.body?.status) === 'HELD');

expectStatus(await request(`/api/v1/jobs/${job.id}/start`, { method: 'POST', headers: auth(provider.accessToken) }), 200, 'job start');

const evidence = await request(`/api/v1/jobs/${job.id}/evidence`, {
  method: 'POST',
  headers: auth(provider.accessToken),
  body: JSON.stringify({ uri: `https://example.invalid/staging/${stamp}` }),
});
expectStatus(evidence, 201, 'evidence submission');

expectStatus(await request(`/api/v1/jobs/${job.id}/deliver`, { method: 'POST', headers: auth(provider.accessToken) }), 200, 'job deliver');
expectStatus(await request(`/api/v1/jobs/${job.id}/accept`, { method: 'POST', headers: auth(owner.accessToken) }), 200, 'job acceptance');

const releaseResult = await request(`/api/v1/payments/release/${job.id}`, { method: 'POST', headers: auth(owner.accessToken) });
assert.ok([200, 202].includes(releaseResult.response.status), `payment release: expected 200/202, got ${releaseResult.response.status}; body=${JSON.stringify(releaseResult.body)}`);
const release = await poll('payment release', () => request(`/api/v1/payments/jobs/${job.id}`, { headers: auth(owner.accessToken) }), (result) => result.response.status === 200 && (result.body?.data?.status ?? result.body?.status) === 'RELEASED');
const releaseData = release.body?.data ?? release.body;
assert.equal(releaseData.status, 'RELEASED', `payment release status=${releaseData.status}`);

console.log(JSON.stringify({
  status: 'PASS',
  workflow: 'auth -> job -> publish -> offer -> accept -> fund -> start -> evidence -> deliver -> accept -> release',
  jobId: job.id,
  offerId: offer.id,
  paymentStatus: releaseData.status,
}));
