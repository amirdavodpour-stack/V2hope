import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-auth-security-');
const api = await startApiServer();
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let user;

test('logout invalidates the current access token through sessionVersion', async () => {
  user = await register(api.json, 'auth-logout@example.com');
  const before = await api.json('/providers/me', { headers: auth(user.accessToken) });
  assert.equal(before.status, 200);

  const logout = await api.json('/auth/logout', { method: 'POST', headers: auth(user.accessToken) });
  assert.equal(logout.status, 200);
  assert.equal(logout.body.data.ok, true);

  const afterLogout = await api.json('/providers/me', { headers: auth(user.accessToken) });
  assert.equal(afterLogout.status, 401);
  assert.equal(afterLogout.body.error.code, 'UNAUTHORIZED');

  const refresh = await api.json('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: user.refreshToken }) });
  assert.equal(refresh.status, 401);
});

test('password reset request is generic for unknown accounts', async () => {
  const r = await api.json('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email: 'does-not-exist-security@example.com' }),
  });
  assert.equal(r.status, 202);
  assert.equal(r.body.data.ok, true);
  assert.match(r.body.data.message, /If the account exists/i);
  assert.equal(Object.prototype.hasOwnProperty.call(r.body.data, 'resetToken'), false);
});

after(async () => closeApi({ ...api, tmp }));
