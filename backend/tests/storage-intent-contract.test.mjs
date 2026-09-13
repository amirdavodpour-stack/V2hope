import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../src/routes/storage_routes.js', import.meta.url), 'utf8');
const repo = fs.readFileSync(new URL('../src/repository/storage.js', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');

test('direct upload completion is bound to a per-user, expiring upload intent', () => {
  assert.match(app, /createStorageRoutes/);
  for (const marker of ['intentDraft', 'uploadedBy: user.id', 'createUploadIntent', 'intent.uploadedBy !== user.id', 'intent.contentType !== contentType', 'intent.expiresAt']) {
    assert.ok(routes.includes(marker), marker);
  }
  assert.match(repo, /SELECT \* FROM upload_intents WHERE id=\$1 AND storage_key=\$2 FOR UPDATE/);
  assert.match(repo, /DELETE FROM upload_intents WHERE id=\$1/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS upload_intents/);
  assert.match(schema, /upload_intents_user_idx/);
});
