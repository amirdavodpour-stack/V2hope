import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = Boolean(process.env.DATABASE_URL);
if (process.env.REQUIRE_INTEGRATION === '1' && !enabled) throw new Error('REQUIRE_INTEGRATION=1 but DATABASE_URL is missing');

const MAPPED_TABLES = [
  'users','providers','refresh_tokens','reset_tokens','categories','jobs','offers','job_applications','payments',
  'ledger_entries','settlements','refunds','payment_webhook_events','evidence','uploads','upload_intents',
  'audit_logs','notifications','notification_preferences','notification_devices','analytics_events','crash_reports','trust_reports',
];

test('PostgreSQL bootstrap creates every mapped application table and can load state', { skip: !enabled }, async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATA_FILE = '/tmp/hope-empty-test-data.json';
  const { initDatabase, getPool, db } = await import('../src/db.js');
  await initDatabase();
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name = ANY($1::text[])
    ORDER BY table_name`, [MAPPED_TABLES]);
  assert.equal(rows.length, MAPPED_TABLES.length);
  assert.ok(Array.isArray(db.collection.notifications));
  assert.ok(Array.isArray(db.collection.analyticsEvents));
  await db.close();
});

// Prove every multi-vertical DDL statement really applies to PostgreSQL,
// and that a second createSchema run is a no-op (idempotent bootstrap).
test('Multi-vertical DDL applies to PostgreSQL and is idempotent', { skip: !enabled }, async () => {
  const { default: pgModule } = await import('pg');
  const { createSchema } = await import('../src/db/schema.js');
  const pool = new pgModule.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const client = await pool.connect();
  try {
    const columnType = async (table, column) => {
      const { rows } = await client.query(
        `SELECT data_type, is_nullable, column_default FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, column]);
      return rows[0] || null;
    };
    const indexExists = async (name) => {
      const { rows } = await client.query(
        `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`, [name]);
      return rows.length === 1;
    };
    const snapshot = async () => {
      const { rows } = await client.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns WHERE table_schema='public'
         ORDER BY table_name, column_name`);
      return JSON.stringify(rows);
    };

    // First application (may be a no-op if a previous test already bootstrapped).
    await createSchema(client);

    // verticals table + the seeded 'jobs' row.
    const verticalSlug = await client.query(`SELECT id, slug, is_active FROM verticals WHERE slug='jobs'`);
    assert.equal(verticalSlug.rowCount, 1, "the 'jobs' vertical must be seeded");
    assert.equal(verticalSlug.rows[0].is_active, true);
    const config = await columnType('verticals', 'config');
    assert.equal(config.data_type, 'jsonb');
    assert.equal(config.is_nullable, 'NO');

    // categories.vertical_id + jobs.vertical_id + jobs.attributes.
    const catVertical = await columnType('categories', 'vertical_id');
    assert.equal(catVertical.data_type, 'uuid');
    assert.equal(catVertical.is_nullable, 'YES');
    const jobVertical = await columnType('jobs', 'vertical_id');
    assert.equal(jobVertical.data_type, 'uuid');
    const jobAttributes = await columnType('jobs', 'attributes');
    assert.equal(jobAttributes.data_type, 'jsonb');
    assert.equal(jobAttributes.is_nullable, 'NO');
    assert.match(jobAttributes.column_default, /'\{\}'::jsonb/);

    // The three vertical-related indexes.
    for (const idx of ['verticals_active_idx', 'categories_vertical_idx', 'jobs_vertical_idx']) {
      assert.ok(await indexExists(idx), `${idx} must exist`);
    }

    // Backfills: nothing may be left unassigned, and re-running changes nothing.
    const before = await snapshot();
    const verticalCountBefore = (await client.query('SELECT count(*)::int AS n FROM verticals')).rows[0].n;

    // Second application — must succeed and change neither shape nor seed rows.
    await createSchema(client);

    assert.equal(await snapshot(), before, 'a second createSchema must not alter the schema');
    const verticalCountAfter = (await client.query('SELECT count(*)::int AS n FROM verticals')).rows[0].n;
    assert.equal(verticalCountAfter, verticalCountBefore, 'the jobs seed must not duplicate');
    assert.equal(
      (await client.query('SELECT count(*)::int AS n FROM verticals WHERE slug=\'jobs\'')).rows[0].n, 1);
    assert.equal(
      (await client.query('SELECT count(*)::int AS n FROM categories WHERE vertical_id IS NULL')).rows[0].n, 0,
      'the categories backfill must leave no NULL vertical_id');
    assert.equal(
      (await client.query('SELECT count(*)::int AS n FROM jobs WHERE vertical_id IS NULL')).rows[0].n, 0,
      'the jobs backfill must leave no NULL vertical_id');
  } finally {
    client.release();
    await pool.end();
  }
});

// The backfills are only meaningfully proven against real rows that
// predate vertical_id. Insert such rows, re-run createSchema, assert they are
// assigned to the jobs vertical and that a further run is a no-op. Everything
// happens inside a transaction that is rolled back, so no rows are left behind.
test('Backfills assign pre-existing categories and jobs to the jobs vertical', { skip: !enabled }, async () => {
  const { default: pgModule } = await import('pg');
  const { createSchema } = await import('../src/db/schema.js');
  const pool = new pgModule.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const client = await pool.connect();
  try {
    await createSchema(client);
    await client.query('BEGIN');
    const userId = (await client.query(
      `INSERT INTO users(id,email,password_hash,display_name,created_at)
       VALUES(gen_random_uuid(),'backfill@example.test','x','backfill',NOW()) RETURNING id`)).rows[0].id;
    const categoryId = (await client.query(
      `INSERT INTO categories(id,slug,name,created_at,vertical_id)
       VALUES(gen_random_uuid(),'s13-legacy-category','Legacy',NOW(),NULL) RETURNING id`)).rows[0].id;
    const jobId = (await client.query(
      `INSERT INTO jobs(id,owner_id,title,description,category_id,job_type,budget_type,budget_min,budget_max,
                        duration,acceptance_criteria,status,created_at,updated_at,vertical_id)
       VALUES(gen_random_uuid(),$1,'S13 legacy job','desc',$2,'ONE_OFF','FIXED',10,20,1,'ac','DRAFT',NOW(),NOW(),NULL)
       RETURNING id`, [userId, categoryId])).rows[0].id;

    // Sanity: the rows really are unassigned before the backfill runs.
    assert.equal((await client.query('SELECT vertical_id FROM categories WHERE id=$1', [categoryId])).rows[0].vertical_id, null);
    assert.equal((await client.query('SELECT vertical_id FROM jobs WHERE id=$1', [jobId])).rows[0].vertical_id, null);

    await createSchema(client);

    const jobsVerticalId = (await client.query("SELECT id FROM verticals WHERE slug='jobs'")).rows[0].id;
    const categoryAfter = (await client.query('SELECT vertical_id FROM categories WHERE id=$1', [categoryId])).rows[0].vertical_id;
    const jobAfter = (await client.query('SELECT vertical_id FROM jobs WHERE id=$1', [jobId])).rows[0].vertical_id;
    assert.equal(categoryAfter, jobsVerticalId);
    assert.equal(jobAfter, jobsVerticalId);

    // Idempotent: a further run must not move an already-assigned row.
    await createSchema(client);
    assert.equal((await client.query('SELECT vertical_id FROM categories WHERE id=$1', [categoryId])).rows[0].vertical_id, jobsVerticalId);
    assert.equal((await client.query('SELECT vertical_id FROM jobs WHERE id=$1', [jobId])).rows[0].vertical_id, jobsVerticalId);
    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
});
