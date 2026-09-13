import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;

test('Wave 3 notification runtime contract requires authenticated provider delivery', () => {
  const worker = fs.readFileSync(`${root}/src/outbox_worker.js`, 'utf8');
  const handlers = fs.readFileSync(`${root}/src/outbox_handlers.js`, 'utf8');
  const provider = fs.readFileSync(`${root}/src/notification_provider.js`, 'utf8');
  assert.match(handlers, /deliverNotification/);
  assert.match(handlers, /listNotificationDevices/);
  assert.match(handlers, /getUserEmail/);
  assert.match(handlers, /targetCount/);
  assert.match(provider, /notificationProviderToken/);
  assert.match(provider, /authorization.*Bearer/);
});

test('Wave 3 configuration requires HTTPS notification providers in production', () => {
  const config = fs.readFileSync(`${root}/src/config.js`, 'utf8');
  assert.match(config, /NOTIFICATION_PUSH_URL must use HTTPS/);
  assert.match(config, /NOTIFICATION_EMAIL_URL must use HTTPS/);
  assert.match(config, /NOTIFICATION_PROVIDER_TOKEN/);
});

test('Wave 3 device route supports Android, iOS and web token registration', () => {
  const routes = fs.readFileSync(`${root}/src/routes/notification_routes.js`, 'utf8');
  assert.match(routes, /ANDROID.*IOS.*WEB/);
  assert.match(routes, /registerNotificationDevice/);
  assert.match(routes, /listNotificationDevices/);
  assert.match(routes, /disableNotificationDevice/);
});
