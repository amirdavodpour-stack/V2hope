import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-notification-delta-');
const api = await startApiServer();
function auth(token) { return {Authorization: `Bearer ${token}`}; }

async function seedNotification(userId, suffix) {
  const item = api.db.insert('notifications', {
    id: api.db.id(), userId, type: 'PAYMENT_UPDATE', title: `n-${suffix}`, body: 'body',
    data: {dedupeKey: `notif:${suffix}`}, readAt: null, createdAt: new Date().toISOString(),
  });
  await api.db.save();
  return item;
}

test('notification preferences are lazily created with safe defaults and patch atomically', async () => {
  const user = await register(api.json, 'notify-pref@example.com');
  const initial = await api.json('/notifications/preferences', {headers: auth(user.accessToken)});
  assert.equal(initial.status, 200);
  assert.equal(initial.body.data.inApp, true);
  assert.equal(initial.body.data.marketing, false);

  const updated = await api.json('/notifications/preferences', {
    method: 'PUT', headers: auth(user.accessToken),
    body: JSON.stringify({push: false, marketing: true}),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.push, false);
  assert.equal(updated.body.data.marketing, true);
});

test('empty preference patch is rejected instead of silently succeeding', async () => {
  const user = await register(api.json, 'notify-empty@example.com');
  const r = await api.json('/notifications/preferences', {method: 'PUT', headers: auth(user.accessToken), body: '{}'});
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_PREFERENCES');
});

test('notifications are isolated by recipient and read endpoints cannot mutate another user', async () => {
  const a = await register(api.json, 'notify-a@example.com');
  const b = await register(api.json, 'notify-b@example.com');
  const aN = await seedNotification(a.user.id, 'a');
  const bN = await seedNotification(b.user.id, 'b');

  const aList = await api.json('/notifications', {headers: auth(a.accessToken)});
  assert.equal(aList.status, 200);
  assert.deepEqual(aList.body.data.items.map((x) => x.id), [aN.id]);

  const crossRead = await api.json(`/notifications/${bN.id}/read`, {method: 'POST', headers: auth(a.accessToken)});
  assert.equal(crossRead.status, 404);
  assert.equal(api.db.collection.notifications.find((x) => x.id === bN.id).readAt, null);
});

test('mark-read is idempotent for already-read notifications and mark-all updates only unread own records', async () => {
  const user = await register(api.json, 'notify-read@example.com');
  const first = await seedNotification(user.user.id, 'r1');
  const second = await seedNotification(user.user.id, 'r2');
  const other = await register(api.json, 'notify-other@example.com');
  const foreign = await seedNotification(other.user.id, 'foreign');

  const read = await api.json(`/notifications/${first.id}/read`, {method: 'POST', headers: auth(user.accessToken)});
  assert.equal(read.status, 200);
  const readAgain = await api.json(`/notifications/${first.id}/read`, {method: 'POST', headers: auth(user.accessToken)});
  assert.equal(readAgain.status, 200);

  const all = await api.json('/notifications/read-all', {method: 'POST', headers: auth(user.accessToken)});
  assert.equal(all.status, 200);
  assert.equal(all.body.data.updated, 1);
  assert.ok(api.db.collection.notifications.find((x) => x.id === first.id).readAt);
  assert.ok(api.db.collection.notifications.find((x) => x.id === second.id).readAt);
  assert.equal(api.db.collection.notifications.find((x) => x.id === foreign.id).readAt, null);
});

test('device registration normalizes platform and prevents under-length tokens', async () => {
  const user = await register(api.json, 'notify-device@example.com');
  const bad = await api.json('/notifications/devices', {method: 'POST', headers: auth(user.accessToken), body: JSON.stringify({platform: 'ANDROID', token: 'short'})});
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'INVALID_FIELD');

  const good = await api.json('/notifications/devices', {method: 'POST', headers: auth(user.accessToken), body: JSON.stringify({platform: 'android', token: '0123456789ABCDEF'})});
  assert.equal(good.status, 200);
  assert.equal(good.body.data.platform, 'ANDROID');
});

test('device deletion cannot disable another user device', async () => {
  const a = await register(api.json, 'notify-device-a@example.com');
  const b = await register(api.json, 'notify-device-b@example.com');
  const created = await api.json('/notifications/devices', {method: 'POST', headers: auth(b.accessToken), body: JSON.stringify({platform: 'WEB', token: '0123456789-device-b'})});
  const cross = await api.json(`/notifications/devices/${created.body.data.id}`, {method: 'DELETE', headers: auth(a.accessToken)});
  assert.equal(cross.status, 404);
  assert.equal(api.db.collection.notificationDevices.find((x) => x.id === created.body.data.id).enabled, true);
});


test('device registration cannot reassign a token owned by another user', async () => {
  const a = await register(api.json, 'notify-token-owner@example.com');
  const b = await register(api.json, 'notify-token-attacker@example.com');
  const token = '0123456789-cross-user-token';
  const created = await api.json('/notifications/devices', {
    method: 'POST', headers: auth(a.accessToken),
    body: JSON.stringify({platform: 'ANDROID', token}),
  });
  assert.equal(created.status, 200);
  const cross = await api.json('/notifications/devices', {
    method: 'POST', headers: auth(b.accessToken),
    body: JSON.stringify({platform: 'IOS', token}),
  });
  assert.equal(cross.status, 403);
  assert.equal(api.db.collection.notificationDevices.find(x => x.token === token).userId, a.user.id);
});

after(async () => closeApi({...api, tmp}));
