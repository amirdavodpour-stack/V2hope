import crypto from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const LOCK_KEY = 827361904129731;

async function loadMigrations() {
  const names = (await readdir(MIGRATIONS_DIR)).filter((name) => /^\d+_[a-z0-9_]+\.js$/i.test(name)).sort();
  const migrations = [];
  for (const name of names) {
    const module = await import(pathToFileURL(path.join(MIGRATIONS_DIR, name)).href);
    const migration = module.migration;
    if (!migration || !Number.isInteger(migration.version) || !migration.name || typeof migration.up !== 'function' || typeof migration.down !== 'function') {
      throw new Error(`Invalid migration module: ${name}`);
    }
    migrations.push({ ...migration, file: name });
  }
  for (let i = 1; i < migrations.length; i += 1) {
    if (migrations[i].version !== migrations[i - 1].version + 1) {
      throw new Error(`Migration sequence gap: ${migrations[i - 1].version} -> ${migrations[i].version}`);
    }
  }
  return migrations;
}

function checksumMigration(migration) {
  const canonical = `${migration.file}\n${migration.version}\n${migration.name}\n${migration.up.toString()}\n${migration.down.toString()}`;
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function ensureMetadataTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_ms INTEGER NOT NULL DEFAULT 0
    );
  `);
}

async function acquireLock(client) {
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
}

async function releaseLock(client) {
  await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
}

export async function migrationStatus(client) {
  const migrations = await loadMigrations();
  await ensureMetadataTable(client);
  const { rows } = await client.query('SELECT version, name, checksum, applied_at, execution_ms FROM schema_migrations ORDER BY version');
  const applied = new Map(rows.map((row) => [row.version, row]));
  return migrations.map((migration) => {
    const row = applied.get(migration.version);
    const checksum = checksumMigration(migration);
    return {
      version: migration.version,
      name: migration.name,
      file: migration.file,
      checksum,
      appliedAt: row?.applied_at ?? null,
      executionMs: row?.execution_ms ?? null,
      state: !row ? 'pending' : row.checksum === checksum ? 'applied' : 'drifted',
    };
  });
}

export async function assertNoDrift(client) {
  const status = await migrationStatus(client);
  const drifted = status.filter((item) => item.state === 'drifted');
  if (drifted.length) {
    throw new Error(`Migration checksum drift detected: ${drifted.map((item) => `${item.version}_${item.name}`).join(', ')}`);
  }
  const unknown = await client.query(`
    SELECT version, name FROM schema_migrations
    WHERE version > (SELECT COALESCE(MAX(version), 0) FROM schema_migrations)
  `);
  // The query above is intentionally defensive; unknown historical rows are checked below.
  const knownVersions = new Set(status.map((item) => item.version));
  const appliedRows = await client.query('SELECT version, name FROM schema_migrations');
  const unexpected = appliedRows.rows.filter((row) => !knownVersions.has(row.version));
  if (unexpected.length || unknown.rows.length) {
    throw new Error(`Unknown migration records detected: ${unexpected.map((row) => row.version).join(', ')}`);
  }
  return status;
}

export async function runMigrations(client) {
  const migrations = await loadMigrations();
  await ensureMetadataTable(client);
  await acquireLock(client);
  try {
    const current = await migrationStatus(client);
    const drifted = current.filter((item) => item.state === 'drifted');
    if (drifted.length) throw new Error(`Migration checksum drift detected: ${drifted.map((item) => item.version).join(', ')}`);

    const applied = new Set(current.filter((item) => item.state === 'applied').map((item) => item.version));
    const appliedRows = new Map((await client.query('SELECT version, name FROM schema_migrations')).rows.map((row) => [row.version, row.name]));
    for (const version of appliedRows.keys()) {
      if (!migrations.some((migration) => migration.version === version)) {
        throw new Error(`Unknown migration version already recorded: ${version}`);
      }
    }

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      const started = process.hrtime.bigint();
      await client.query('BEGIN');
      try {
        await migration.up(client);
        const executionMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - started) / 1e6));
        await client.query(
          'INSERT INTO schema_migrations(version, name, checksum, applied_at, execution_ms) VALUES($1,$2,$3,NOW(),$4)',
          [migration.version, migration.name, checksumMigration(migration), executionMs],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${migration.version}_${migration.name} failed: ${error.message}`, { cause: error });
      }
    }
    return migrationStatus(client);
  } finally {
    await releaseLock(client);
  }
}

export async function rollbackLastMigration(client) {
  await ensureMetadataTable(client);
  await acquireLock(client);
  try {
    const migrations = await loadMigrations();
    const result = await client.query('SELECT version, name, checksum FROM schema_migrations ORDER BY version DESC LIMIT 1');
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const migration = migrations.find((item) => item.version === row.version);
    if (!migration) throw new Error(`Cannot rollback unknown migration version: ${row.version}`);
    if (row.checksum !== checksumMigration(migration)) throw new Error(`Cannot rollback drifted migration: ${row.version}_${row.name}`);
    const started = process.hrtime.bigint();
    await client.query('BEGIN');
    try {
      await migration.down(client);
      await client.query('DELETE FROM schema_migrations WHERE version=$1', [migration.version]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Rollback ${migration.version}_${migration.name} failed: ${error.message}`, { cause: error });
    }
    return { version: migration.version, name: migration.name, executionMs: Math.max(0, Math.round(Number(process.hrtime.bigint() - started) / 1e6)) };
  } finally {
    await releaseLock(client);
  }
}

export { checksumMigration, loadMigrations };
