import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const db=fs.readFileSync(new URL('../src/db.js',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../src/db/schema.js',import.meta.url),'utf8');
const repo=fs.readFileSync(new URL('../src/repository.js',import.meta.url),'utf8');
const notificationsRepo=fs.readFileSync(new URL('../src/repository/notifications.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../src/outbox_worker.js',import.meta.url),'utf8');
const handlers=fs.readFileSync(new URL('../src/outbox_handlers.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const notificationRoutes=fs.readFileSync(new URL('../src/routes/notification_routes.js',import.meta.url),'utf8');
const mobile=fs.readFileSync(new URL('../../lib/features/notifications/notifications_page.dart',import.meta.url),'utf8');
const notificationRepo=fs.readFileSync(new URL('../../lib/core/notifications/notification_repository.dart',import.meta.url),'utf8');
const notificationModel=fs.readFileSync(new URL('../../lib/core/notifications/notification.dart',import.meta.url),'utf8');

test('notification persistence has user isolation and preference defaults',()=>{
  assert.match(schema,/CREATE TABLE IF NOT EXISTS notifications/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS notification_preferences/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS notification_devices/);
  assert.match(notificationsRepo,/export async function queueNotification/);
  assert.match(notificationsRepo,/NOTIFICATION_DISPATCH/);
});

test('notification worker supports in-app delivery and configured push/email webhooks',()=>{
  assert.match(handlers,/event\.event_type === 'NOTIFICATION_DISPATCH'/);
  assert.match(handlers,/notificationPushUrl/);
  assert.match(handlers,/notificationEmailUrl/);
});

test('notification HTTP surface exposes read, preferences and device registration',()=>{
  assert.match(app,/parts\[0\] === 'notifications'/);
  assert.match(app,/createNotificationRoutes/);
  assert.match(notificationRoutes,/read-all/);
  assert.match(notificationRoutes,/preferences/);
  assert.match(notificationRoutes,/devices/);
});

test('mobile notifications are repository-backed and typed',()=>{
  assert.match(mobile,/ApplicationRegistry/);
  assert.match(mobile,/listNotifications/);
  assert.match(mobile,/markNotificationRead/);
  assert.match(mobile,/markAllNotificationsRead/);
  assert.doesNotMatch(mobile,/ApiClient/);
  assert.doesNotMatch(mobile,/read-all/);
  assert.match(notificationRepo,/abstract interface class NotificationRepository/);
  assert.match(notificationRepo,/markAllRead/);
  assert.match(notificationModel,/class HopeNotification/);
  assert.match(notificationModel,/class HopeNotificationPreferences/);
  assert.match(notificationModel,/final Map<String, dynamic> data/);
  assert.match(notificationModel,/bool get hasAction/);
  assert.match(mobile,/openNotification/);
  assert.match(mobile,/HopeRoutes\.jobDetail/);
  assert.match(mobile,/HopeRoutes\.transaction/);
  assert.match(mobile,/TransactionRepository/);
  assert.match(mobile,/UploadQueue/);
  assert.match(notificationRepo,/getPreferences/);
  assert.match(notificationRepo,/updatePreferences/);
  assert.match(mobile,/loadNotificationPreferences/);
  assert.match(mobile,/updateNotificationPreferences/);
});
