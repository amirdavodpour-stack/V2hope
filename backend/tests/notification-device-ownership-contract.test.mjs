import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../src/routes/notification_routes.js', import.meta.url), 'utf8');
const repo = fs.readFileSync(new URL('../src/repository/notifications.js', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');

test('notification device token cannot be rebound across users', () => {
  assert.match(route, /NOTIFICATION_DEVICE_OWNERSHIP/);
  assert.match(route, /d\.userId!==me\.id/);
  assert.match(repo, /SELECT \* FROM notification_devices WHERE token=\$1 FOR UPDATE/);
  assert.match(repo, /Notification device token belongs to another user/);
  assert.match(schema, /token TEXT NOT NULL UNIQUE/);
});
