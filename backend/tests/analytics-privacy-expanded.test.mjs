import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-analytics-privacy-delta-');
const api = await startApiServer();

function auth(token) { return {Authorization: `Bearer ${token}`}; }

async function makeAdmin() {
  const admin = await register(api.json, 'privacy-admin@example.com', 'Admin');
  const row = api.db.collection.users.find((x) => x.id === admin.user.id);
  row.role = 'ADMIN';
  row.sessionVersion += 1;
  await api.db.save();
  const login = await api.json('/auth/login', {
    method: 'POST',
    body: JSON.stringify({email: 'privacy-admin@example.com', password: 'pass123456789'}),
  });
  return login.body.data;
}

test('analytics events accept anonymous users, sanitize sensitive properties, and dedupe', async () => {
  const event = {
    eventName: 'search_viewed',
    platform: 'ANDROID',
    anonymousId: 'device-secret-123',
    properties: {
      email: 'person@example.com',
      password: 'should-not-survive',
      nested: {apiKey: 'abc', ok: 'yes'},
    },
  };
  const a = await api.json('/analytics/events', {
    method: 'POST',
    headers: {'x-analytics-idempotency-key': 'analytics-key-1'},
    body: JSON.stringify(event),
  });
  const b = await api.json('/analytics/events', {
    method: 'POST',
    headers: {'x-analytics-idempotency-key': 'analytics-key-1'},
    body: JSON.stringify(event),
  });
  assert.equal(a.status, 201);
  assert.equal(a.body.data.created, true);
  assert.equal(b.status, 200);
  assert.equal(b.body.data.created, false);
  const stored = api.db.collection.analyticsEvents.find((x) => x.dedupeKey === 'analytics-key-1');
  assert.equal(stored.properties.email, undefined);
  assert.equal(stored.properties.password, undefined);
  assert.equal(stored.properties.nested, undefined);
});

test('analytics idempotency key rejects unsafe characters', async () => {
  const r = await api.json('/analytics/events', {
    method: 'POST',
    headers: {'x-analytics-idempotency-key': 'bad key!'},
    body: JSON.stringify({eventName: 'app_opened', platform: 'WEB'}),
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_IDEMPOTENCY_KEY');
});

test('crash ingestion redacts credentials in message and stack', async () => {
  const r = await api.json('/analytics/crashes', {
    method: 'POST',
    body: JSON.stringify({
      message: 'login failed for person@example.com token=supersecret',
      stack: 'Authorization: Bearer abcdefgh password=hunter2',
      fingerprint: 'crash-1234',
      platform: 'ANDROID',
    }),
  });
  assert.equal(r.status, 201);
  const crash = api.db.collection.crashReports.find((x) => x.id === r.body.data.id);
  assert.ok(crash);
  assert.equal(crash.message.includes('person@example.com'), false);
  assert.equal(crash.stack.includes('Bearer abcdefgh'), false);
});

test('admin analytics endpoint enforces admin role and clamps days', async () => {
  const user = await register(api.json, 'privacy-user@example.com');
  const denied = await api.json('/analytics/admin?days=9999', {headers: auth(user.accessToken)});
  assert.equal(denied.status, 403);
  const admin = await makeAdmin();
  const allowed = await api.json('/analytics/admin?days=9999', {headers: auth(admin.accessToken)});
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.days, 365);
});

test('privacy export is user-scoped and account deletion requires exact confirmation', async () => {
  const user = await register(api.json, 'privacy-owner@example.com');
  const exportResponse = await api.json('/account/export', {headers: auth(user.accessToken)});
  assert.equal(exportResponse.status, 200);
  assert.equal(exportResponse.body.data.account.email, 'privacy-owner@example.com');
  assert.ok(!JSON.stringify(exportResponse.body.data).includes(user.accessToken));

  const badDelete = await api.json('/account/delete', {
    method: 'POST', headers: auth(user.accessToken), body: JSON.stringify({confirmation: 'CONFIRM'}),
  });
  assert.equal(badDelete.status, 400);
  assert.equal(badDelete.body.error.code, 'CONFIRMATION_REQUIRED');

  const deleteResponse = await api.json('/account/delete', {
    method: 'POST', headers: auth(user.accessToken), body: JSON.stringify({confirmation: 'DELETE'}),
  });
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.data.deleted, true);
  const deleted = api.db.collection.users.find((x) => x.id === user.user.id);
  assert.equal(deleted.status, 'DELETED');
  assert.notEqual(deleted.email, 'privacy-owner@example.com');
  assert.equal(api.db.collection.refreshTokens.some((x) => x.userId === user.user.id), false);
});

after(async () => closeApi({...api, tmp}));
