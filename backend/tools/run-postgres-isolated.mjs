import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error('DATABASE_URL is required for isolated PostgreSQL tests.');
  process.exit(2);
}

const parsed = new URL(sourceUrl);
const baseDb = (parsed.pathname || '').replace(/^\//, '') || 'postgres';
const safeBase = baseDb.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24) || 'postgres';
const dbName = `hope_test_${safeBase}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`.slice(0, 63);
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
adminUrl.search = '';

const admin = new Client({ connectionString: adminUrl.toString() });
let child;
let exitCode = 1;

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${quoteIdent(dbName)}`);

  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${dbName}`;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testUrl.toString(),
  };

  child = spawn(process.execPath, [
    '--test',
    '--test-concurrency=1',
    'tests/postgres-bootstrap-integration.test.mjs',
    'tests/postgres-repository-e2e.test.mjs',
  ], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) return resolve(1);
      resolve(code ?? 1);
    });
  });
} finally {
  if (child?.exitCode === null && child?.signalCode === null) {
    try { child.kill('SIGTERM'); } catch {}
  }
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)} WITH (FORCE)`);
  } catch (error) {
    console.error(`Failed to drop isolated database ${dbName}: ${error.message}`);
    exitCode = exitCode === 0 ? 1 : exitCode;
  }
  await admin.end().catch(() => {});
}

process.exitCode = exitCode;

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
