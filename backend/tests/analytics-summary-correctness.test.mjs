import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('analytics summary computes unique users across the full time window', () => {
  const source = fs.readFileSync(new URL('../src/repository/analytics.js', import.meta.url), 'utf8');
  assert.match(source, /COUNT\(DISTINCT user_id\)::int FROM analytics_events[\s\S]*?AS unique_users/);
  assert.match(source, /uniqueUsers:Number\(rows\[0\]\?\.unique_users\|\|0\)/);
  assert.doesNotMatch(source, /uniqueUsers:rows\.reduce\(\(a,r\)=>Math\.max/);
});
