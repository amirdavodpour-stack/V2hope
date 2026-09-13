import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppViewHelpers } from '../src/application/view_helpers.js';

function fixture() {
  const db = {
    collection: {
      providers: [{ userId: 'u2', id: 'p1' }],
      categories: [{ id: 'c1', slug: 'design', name: 'Design' }],
      offers: [{ jobId: 'j1' }, { jobId: 'j1' }, { jobId: 'j2' }],
      audit: [],
    },
    id: () => 'audit-1',
    insert: (_name, value) => value,
  };
  const users = new Map([
    ['u1', { id: 'u1', displayName: 'Owner', role: 'EMPLOYER', email: 'owner@example.test' }],
    ['u2', { id: 'u2', displayName: 'Provider', role: 'PROVIDER', email: 'provider@example.test' }],
  ]);
  const repo = {
    insertAudit: async (value) => value,
    findProviderByUserId: async (id) => db.collection.providers.find((p) => p.userId === id) || null,
    findCategoryByIdOrSlug: async (id) => db.collection.categories.find((c) => c.id === id || c.slug === id) || null,
    listOffersForJob: async (id) => db.collection.offers.filter((o) => o.jobId === id),
  };
  const HttpError = class extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } };
  const helpers = createAppViewHelpers({ db, repo, config: { paymentCurrency: 'CHF' }, getUserById: async (id) => users.get(id) || null, now: () => '2026-08-29T00:00:00.000Z', HttpError, env: {}, categories: db.collection.categories, legacy: { providers: db.collection.providers, offers: db.collection.offers } });
  return { helpers, db };
}

test('view helpers remain dependency-injected and preserve job shaping semantics', async () => {
  const { helpers } = fixture();
  assert.equal(helpers.categoryBy('design').name, 'Design');
  assert.deepEqual(helpers.publicUser({ id: 'u1', displayName: 'Owner', role: 'EMPLOYER', email: 'owner@example.test' }), { id: 'u1', displayName: 'Owner', role: 'EMPLOYER' });
  const map = helpers.buildOfferCountMap();
  assert.equal(map.get('j1'), 2);
  assert.equal(map.get('j2'), 1);
  const job = { id: 'j1', title: 'T', description: 'D', categoryId: 'c1', jobType: 'FIXED', budgetType: 'FIXED', budgetMin: 100, budgetMax: 200, duration: '1d', acceptanceCriteria: 'A', status: 'PUBLISHED', ownerId: 'u1', providerId: 'u2', city: 'Zurich', kind: 'MISSION', visibility: 'PUBLIC', schedule: null, monthlySalary: null, applicationDeadline: null, createdAt: 'x', updatedAt: 'y' };
  const view = await helpers.jobView(job, 'u1', map);
  assert.equal(view.offerCount, 2);
  assert.equal(view.category, 'Design');
  assert.equal(view.isOwner, true);
});

test('enforceJobState preserves the HTTP error contract', () => {
  const { helpers } = fixture();
  assert.throws(() => helpers.enforceJobState({ status: 'ASSIGNED' }, ['PUBLISHED']), (err) => err.code === 'INVALID_STATE' && err.status === 409);
});
