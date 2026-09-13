import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-notification-channel-');
const api = await startApiServer();
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let user;

test('disabled in-app notifications do not silently create records', async () => {
  user = await register(api.json, 'notification-channel@example.com');
  const prefs = await api.json('/notifications/preferences', { headers: auth(user.accessToken) });
  assert.equal(prefs.status, 200);
  const patched = await api.json('/notifications/preferences', {
    method: 'PUT',
    headers: auth(user.accessToken),
    body: JSON.stringify({ inApp: false, push: false, email: false }),
  });
  assert.equal(patched.status, 200);

  const before = api.db.collection.notifications.filter((x) => x.userId === user.user.id).length;
  const created = await api.json('/notifications/preferences', { headers: auth(user.accessToken) });
  assert.equal(created.status, 200);
  const after = api.db.collection.notifications.filter((x) => x.userId === user.user.id).length;
  assert.equal(after, before);
});

after(async () => closeApi({ ...api, tmp }));
