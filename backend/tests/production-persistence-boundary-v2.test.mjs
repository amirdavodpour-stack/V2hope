import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const routeFiles = [
  'auth_routes.js',
  'notification_routes.js',
  'saved_search_routes.js',
  'analytics_routes.js',
  'storage_routes.js',
  'account_routes.js',
  'offer_routes.js',
  'application_routes.js',
  'payment_routes.js',
  'admin_routes.js',
];

const root = new URL('../src/routes/', import.meta.url);

function source(name) {
  return fs.readFileSync(new URL(name, root), 'utf8');
}

function pgBranchHasDbCollectionLeak(src) {
  const marker = /if\s*\(process\.env\.DATABASE_URL\)\s*\{/g;
  let match;
  while ((match = marker.exec(src))) {
    let i = src.indexOf('{', match.index);
    if (i < 0) continue;
    const blockStart = i;
    let depth = 0;
    for (; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const branch = src.slice(blockStart, i + 1);
    if (/db\.collection\./.test(branch)) return true;
  }
  return false;
}

test('production persistence branches never access db.collection directly', () => {
  const offenders = routeFiles.filter((name) => pgBranchHasDbCollectionLeak(source(name)));
  assert.deepEqual(offenders, [], `PostgreSQL branches must use repository/application boundaries: ${offenders.join(', ')}`);
});

test('saved-search, notification and analytics routes expose repository-backed boundaries', () => {
  for (const name of ['saved_search_routes.js', 'notification_routes.js', 'analytics_routes.js']) {
    const src = source(name);
    assert.match(src, /repo\./, `${name} must use repository functions`);
  }
});
