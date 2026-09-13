import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const schema = fs.readFileSync(path.join(root, 'backend/src/db/schema.js'), 'utf8');

test('verticals table is created idempotently', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS verticals \(/);
  for (const col of ['slug TEXT NOT NULL UNIQUE', 'name TEXT NOT NULL', 'name_en', 'description', 'config JSONB', 'is_active BOOLEAN', 'sort_order INTEGER', 'created_at TIMESTAMPTZ']) {
    assert.ok(schema.includes(col), `missing column definition: ${col}`);
  }
});

test('verticals indexes exist', () => {
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS verticals_slug_uq ON verticals\(slug\)/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS verticals_active_idx ON verticals\(is_active,sort_order\)/);
});

test('jobs vertical is seeded idempotently', () => {
  assert.match(schema, /INSERT INTO verticals\(/);
  assert.match(schema, /'jobs'/);
  assert.match(schema, /ON CONFLICT \(slug\) DO NOTHING/);
});

test('verticals is declared before categories (FK ordering for later sessions)', () => {
  assert.ok(schema.indexOf('CREATE TABLE IF NOT EXISTS verticals') < schema.indexOf('CREATE TABLE IF NOT EXISTS categories'));
});

test('categories.vertical_id is added as a nullable FK with backfill and index', () => {
  assert.match(schema, /ALTER TABLE categories ADD COLUMN IF NOT EXISTS vertical_id UUID NULL REFERENCES verticals\(id\) ON DELETE SET NULL;/);
  assert.match(schema, /UPDATE categories SET vertical_id=\(SELECT id FROM verticals WHERE slug='jobs'\) WHERE vertical_id IS NULL;/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS categories_vertical_idx ON categories\(vertical_id,sort_order\)/);
  assert.doesNotMatch(schema, /categories[\s\S]{0,200}vertical_id UUID NOT NULL/);
});

test('categories backfill runs after the verticals seed', () => {
  assert.ok(schema.indexOf("ON CONFLICT (slug) DO NOTHING") < schema.indexOf('UPDATE categories SET vertical_id='));
});

test('jobs gains vertical_id and attributes additively', () => {
  assert.match(schema, /ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vertical_id UUID NULL REFERENCES verticals\(id\) ON DELETE SET NULL;/);
  assert.match(schema, /ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '\{\}'::jsonb;/);
  assert.match(schema, /UPDATE jobs SET vertical_id=\(SELECT id FROM verticals WHERE slug='jobs'\) WHERE vertical_id IS NULL;/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS jobs_vertical_idx ON jobs\(vertical_id,status\)/);
});

test('jobs backfill runs after the verticals seed', () => {
  assert.ok(schema.indexOf("ON CONFLICT (slug) DO NOTHING") < schema.indexOf('UPDATE jobs SET vertical_id='));
});

test('no destructive DDL introduced', () => {
  assert.doesNotMatch(schema, /DROP TABLE|DROP COLUMN|RENAME COLUMN/);
});
