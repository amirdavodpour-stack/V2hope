import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, 'src');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const db = fs.readFileSync(path.join(root, 'db.js'), 'utf8');
const dbRuntime = fs.readFileSync(path.join(root, 'db/runtime.js'), 'utf8');

test('liveness endpoint is independent from database readiness', () => {
  assert.match(app, /url\.pathname === '\/live'/);
  const liveBlock = app.match(/if \(url\.pathname === '\/live'[\s\S]*?\n    }\n    if \(url\.pathname === '\/health'/)?.[0] || '';
  assert.doesNotMatch(liveBlock, /databaseHealth/);
});

test('database health has a bounded query timeout and does not return raw errors', () => {
  assert.match(dbRuntime, /query_timeout:\s*2000/);
  assert.match(dbRuntime, /errorCode: error\?\.code/);
  assert.doesNotMatch(dbRuntime, /error:error\.message/);
});
