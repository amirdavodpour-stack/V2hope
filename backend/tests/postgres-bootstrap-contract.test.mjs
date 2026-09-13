import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const db = fs.readFileSync(path.join(root, 'backend/src/db.js'), 'utf8');
const serialization = fs.readFileSync(path.join(root, 'backend/src/db/serialization.js'), 'utf8');

const expectedMappings = {
  notifications: 'notifications',
  notificationPreferences: 'notification_preferences',
  notificationDevices: 'notification_devices',
  analyticsEvents: 'analytics_events',
  crashReports: 'crash_reports',
  trustReports: 'trust_reports',
  audit: 'audit_logs',
};

for (const [collection, table] of Object.entries(expectedMappings)) {
  test(`PostgreSQL tableMap contains ${collection}`, () => {
    assert.match(db, new RegExp(`${collection}:\\s*'${table}'`));
  });
}

test('all PostgreSQL-persisted extended collections have row serializers', () => {
  for (const collection of ['audit', 'notifications', 'notificationPreferences', 'notificationDevices', 'analyticsEvents', 'crashReports', 'trustReports']) {
    assert.match(serialization, new RegExp(`case '${collection}':\\s*return`));
  }
});
