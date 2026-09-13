import crypto from 'node:crypto';
import { config } from './config.js';
import { fromDbRow, tableColumns } from './db/serialization.js';
import { runMigrations } from './db/migrations.js';
import { pool, getPool, withSqlTransaction, databaseHealth, closePool } from './db/runtime.js';
import { CATEGORY_CATALOG } from './db/categories.js';

const collections = ['users','providers','refreshTokens','resetTokens','categories','jobs','offers','jobApplications','payments','ledgerEntries','settlements','refunds','paymentWebhooks','evidence','uploads','uploadIntents','audit','notifications','notificationPreferences','notificationDevices','analyticsEvents','crashReports','trustReports','savedSearches'];
const tableMap = {
  users: 'users', providers: 'providers', refreshTokens: 'refresh_tokens', resetTokens: 'reset_tokens',
  categories: 'categories', jobs: 'jobs', offers: 'offers', jobApplications: 'job_applications', payments: 'payments', evidence: 'evidence',
  uploads: 'uploads', uploadIntents: 'upload_intents', audit: 'audit_logs', ledgerEntries: 'ledger_entries', settlements: 'settlements', refunds: 'refunds', paymentWebhooks: 'payment_webhook_events',
  notifications: 'notifications', notificationPreferences: 'notification_preferences', notificationDevices: 'notification_devices',
  analyticsEvents: 'analytics_events', crashReports: 'crash_reports', trustReports: 'trust_reports', savedSearches: 'saved_searches',
};
const empty = Object.fromEntries(collections.map((name) => [name, []]));
const isTestRuntime = process.env.NODE_ENV === 'test';
const isPostgresRuntime = Boolean(pool);
const allowLegacyRuntime = isTestRuntime && !isPostgresRuntime;

if (!isPostgresRuntime && !allowLegacyRuntime) {
  throw new Error('PostgreSQL is required outside the explicit NODE_ENV=test runtime');
}

const legacyLoad = allowLegacyRuntime ? (await import('./db/legacy.js')).legacyLoad : null;
const persistLegacyFile = allowLegacyRuntime ? (await import('./db/legacy_adapter.js')).persistLegacyFile : null;

let state = structuredClone(empty);
let initialized = false;
let flushChain = Promise.resolve();
let txDepth = 0;
let dirty = new Set();
let transactionChain = Promise.resolve();

async function loadSqlSnapshot(client) {
  const next = structuredClone(empty);
  for (const collection of collections) {
    const table = tableMap[collection];
    const columns = tableColumns[table] || [];
    const orderBy = columns.includes('created_at') ? 'created_at NULLS FIRST, id' : 'id';
    const { rows } = await client.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
    next[collection] = rows.map((row) => fromDbRow(collection, row));
  }
  return next;
}

export async function initDatabase() {
  if (initialized) return;
  if (!pool) {
    state = legacyLoad({ dataFile: config.dataFile, empty });
    initialized = true;
    return;
  }

  const client = await pool.connect();
  try {
    await runMigrations(client);
    // A SQL snapshot is loaded only for test assertions. Production has no
    // in-memory database state and all application reads/writes go to SQL.
    if (isTestRuntime) state = await loadSqlSnapshot(client);
    await ensureDefaultCategoriesSql(client);
    initialized = true;
    console.log('[db] PostgreSQL is the sole production persistence authority');
  } finally {
    client.release();
  }
}

function flushLegacyNow() {
  if (!allowLegacyRuntime) return;
  const toFlush = new Set(dirty);
  dirty.clear();
  if (!toFlush.size) return;
  flushChain = flushChain.then(() => persistLegacyFile({
    dataFile: config.dataFile,
    state,
    storageDir: config.storageDir,
  }));
}

let flushQueued = false;
function scheduleLegacyFlush() {
  if (!allowLegacyRuntime || flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    flushQueued = false;
    if (txDepth > 0) { scheduleLegacyFlush(); return; }
    flushLegacyNow();
  });
}

function markDirty(collection) {
  if (!allowLegacyRuntime) throw new Error(`Direct db.${collection} mutation is test-runtime only; use repository services with PostgreSQL`);
  dirty.add(collection);
  if (txDepth === 0) scheduleLegacyFlush();
}

export async function withTransaction(fn) {
  if (pool) return withSqlTransaction(async (client) => fn(client));

  const snapshot = structuredClone(state);
  const dirtyBefore = new Set(dirty);
  txDepth += 1;
  try {
    const result = await fn();
    txDepth -= 1;
    scheduleLegacyFlush();
    return result;
  } catch (error) {
    state = snapshot;
    dirty = dirtyBefore;
    txDepth -= 1;
    throw error;
  }
}

export const db = {
  get collection() {
    if (pool && !isTestRuntime) throw new Error('db.collection is unavailable in production; use repository interfaces');
    return state;
  },
  touch(...collectionsToWrite) {
    if (!allowLegacyRuntime) throw new Error('db.touch is unavailable outside the explicit test runtime');
    for (const collection of collectionsToWrite.flat()) {
      if (!collections.includes(collection)) throw new Error(`Unknown collection: ${collection}`);
      dirty.add(collection);
    }
    if (txDepth === 0) scheduleLegacyFlush();
  },
  save() {
    if (!allowLegacyRuntime || txDepth > 0) return Promise.resolve();
    flushLegacyNow();
    return flushChain;
  },
  async flush() { await flushChain; },
  async close() { await flushChain; await closePool(); },
  reset() {
    if (!allowLegacyRuntime) throw new Error('db.reset is unavailable outside the explicit test runtime');
    state = structuredClone(empty);
    dirty = new Set(collections);
    if (txDepth === 0) this.save();
    return state;
  },
  id() { return crypto.randomUUID(); },
  insert(collection, row) {
    if (!allowLegacyRuntime) throw new Error('db.insert is unavailable outside the explicit test runtime');
    state[collection].push(row);
    markDirty(collection);
    return row;
  },
  update(collection, id, patch) {
    if (!allowLegacyRuntime) throw new Error('db.update is unavailable outside the explicit test runtime');
    const item = state[collection].find((x) => x.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    markDirty(collection);
    return item;
  },
};

export { getPool, withSqlTransaction, databaseHealth, closePool };

export async function seedBaseData() {
  if (!allowLegacyRuntime) { await ensureDefaultCategoriesSql(pool); return; }
  const now = new Date().toISOString();
  const bySlug = new Map();
  for (const c of state.categories) bySlug.set(c.slug, c);
  const legacyMap = { development: 'software-development', writing: 'writing', design: 'design', research: 'research', education: 'education' };
  for (const c of state.categories) {
    c.nameEn ??= ''; c.description ??= ''; c.sortOrder ??= 0; c.isActive ??= true;
    if (c.parentId === undefined) c.parentId = null;
    if (legacyMap[c.slug] && c.slug !== legacyMap[c.slug]) c.slug = legacyMap[c.slug];
  }
  for (const spec of CATEGORY_CATALOG) {
    let row = state.categories.find((c) => c.slug === spec.slug);
    if (!row) {
      row = { id: db.id(), slug: spec.slug, name: spec.name, nameEn: spec.nameEn, description: spec.description || '', parentId: null, sortOrder: spec.order, isActive: true, createdAt: now };
      state.categories.push(row);
    } else {
      row.name = spec.name; row.nameEn = spec.nameEn; row.description = spec.description || row.description || ''; row.sortOrder = spec.order; row.isActive = row.isActive !== false;
    }
    bySlug.set(spec.slug, row);
  }
  for (const spec of CATEGORY_CATALOG) {
    const row = bySlug.get(spec.slug);
    if (row) row.parentId = spec.parent ? bySlug.get(spec.parent)?.id || null : null;
  }
  db.touch('categories');
}

async function ensureDefaultCategoriesSql(client = pool) {
  if (!client) throw new Error('PostgreSQL client is required for category seeding');
  const now = new Date().toISOString();
  for (const spec of CATEGORY_CATALOG) {
    await client.query(
      `INSERT INTO categories(id,slug,name,name_en,description,sort_order,is_active,created_at)
       VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,TRUE,$6)
       ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,name_en=EXCLUDED.name_en,description=EXCLUDED.description,sort_order=EXCLUDED.sort_order,is_active=TRUE`,
      [spec.slug, spec.name, spec.nameEn, spec.description || '', spec.order, now],
    );
  }
  for (const spec of CATEGORY_CATALOG) {
    if (!spec.parent) continue;
    await client.query(
      `UPDATE categories child SET parent_id=parent.id FROM categories parent WHERE child.slug=$1 AND parent.slug=$2`,
      [spec.slug, spec.parent],
    );
  }
  await client.query('UPDATE categories SET parent_id=NULL WHERE parent_id=id');
}
