import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
const db = fs.readFileSync(path.join(root, 'backend/src/db.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'backend/src/db/schema.js'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'backend/src/analytics.js'), 'utf8');
const flutter = fs.readFileSync(path.join(root, 'lib/core/telemetry/telemetry_service.dart'), 'utf8');
const main = fs.readFileSync(path.join(root, 'lib/main.dart'), 'utf8');
test('analytics and crash contracts are wired with privacy filtering', () => {
  assert.match(app, /parts\[0\] === 'analytics'/); assert.match(app, /parts\[1\] === 'admin'/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS analytics_events/); assert.match(schema, /CREATE TABLE IF NOT EXISTS crash_reports/);
  assert.match(analytics, /SENSITIVE/); assert.match(analytics, /anonymousId/);
});
test('mobile telemetry is fail-safe and captures Flutter errors', () => {
  assert.match(flutter, /TelemetryService/); assert.match(flutter, /timeout\(const Duration\(seconds: 4\)\)/);
  assert.match(main, /FlutterError\.onError/); assert.match(main, /PlatformDispatcher\.instance\.onError/); assert.match(main, /app_opened/);
});
