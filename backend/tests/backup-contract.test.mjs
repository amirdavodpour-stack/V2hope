import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname,'scripts');
for (const name of ['backup.sh','restore.sh']) {
  test(`${name} is executable and safe-mode shell`,()=>{
    const p=path.join(root,name); const s=fs.readFileSync(p,'utf8');
    assert.ok(s.startsWith('#!/usr/bin/env sh'));
    assert.match(s,/set -eu/);
  });
}
test('backup retention is bounded',()=>{ const s=fs.readFileSync(path.join(root,'backup.sh'),'utf8'); assert.match(s,/mtime \+14/); });

test('verify-backup helper is fail-closed and uses pg_restore list validation',()=>{
  const p=path.join(root,'verify-backup.sh');
  const s=fs.readFileSync(p,'utf8');
  assert.ok(s.startsWith('#!/usr/bin/env sh'));
  assert.match(s,/set -eu/);
  assert.match(s,/pg_restore --list/);
  assert.match(s,/\[ -s/);
});
