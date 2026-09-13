import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const runner = fs.readFileSync(path.join(process.cwd(), 'tools/run-postgres-isolated.mjs'), 'utf8');

test('PostgreSQL integration has an explicit isolated-database runner', () => {
  assert.equal(packageJson.scripts['test:postgres:isolated'], 'NODE_ENV=test node tools/run-postgres-isolated.mjs');
  assert.match(runner, /CREATE DATABASE/);
  assert.match(runner, /DROP DATABASE IF EXISTS/);
  assert.match(runner, /WITH \(FORCE\)/);
  assert.match(runner, /DATABASE_URL/);
  assert.equal(fs.existsSync(path.join(root, 'backend', 'tools', 'run-postgres-isolated.mjs')), true);
});
