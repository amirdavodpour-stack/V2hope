import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const docker = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');

test('PostgreSQL is the sole non-test persistence runtime', () => {
  assert.match(db, /PostgreSQL is required outside the explicit NODE_ENV=test runtime/);
  assert.match(db, /db\.collection is unavailable in production/);
  assert.match(db, /const allowLegacyRuntime = isTestRuntime && !isPostgresRuntime/);
});

test('PostgreSQL boot never hydrates mutable application state from SQL', () => {
  assert.match(db, /if \(isTestRuntime\) state = await loadSqlSnapshot\(client\);/);
  assert.doesNotMatch(db, /const hasData = Object\.values\(loaded\)/);
  assert.doesNotMatch(db, /flushInTx\(client, dirty\)/);
});

test('legacy filesystem adapters are dynamically loaded only for the explicit test runtime', () => {
  assert.match(db, /allowLegacyRuntime \? \(await import\('\.\/db\/legacy\.js'\)\)/);
  assert.match(db, /allowLegacyRuntime \? \(await import\('\.\/db\/legacy_adapter\.js'\)\)/);
});

test('production configuration requires PostgreSQL', () => {
  assert.match(config, /if \(!config\.databaseUrl\) throw new Error\('DATABASE_URL must be set in production'\)/);
});

test('production image cannot rely on a local JSON database', () => {
  assert.doesNotMatch(docker, /DATA_FILE|hope\.json.*database/i);
});
