import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';

const {
  userFromRow, jobFromRow, offerFromRow, paymentFromRow, applicationFromRow, employerCandidateFromRow, verticalFromRow,
} = await import('../src/repository/mappers.js');
const { validateIdempotencyPair, paymentAmountForJob, mapPaymentMutationError } = await import('../src/application/payment_policy.js');
const { verifyPaymentWebhookSignature, normalizePaymentWebhookBody, applyLocalPaymentWebhook } = await import('../src/application/payment_webhook.js');
const { getPool, withSqlTransaction, databaseHealth, closePool } = await import('../src/db/runtime.js');

const now = new Date('2026-02-03T04:05:06.000Z');

function assertHttpError(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error?.status, 400);
    assert.equal(error?.code, code);
    return true;
  });
}

test('row mappers cover user, offer, payment, application, candidate and vertical shapes', () => {
  const user = userFromRow({
    id: 'u1', email: 'u@example.com', password_hash: 'hash', displayName: 'User', role: 'USER', status: 'ACTIVE',
    session_version: '2', createdAt: now,
  });
  assert.deepEqual(user, {
    id: 'u1', email: 'u@example.com', passwordHash: 'hash', displayName: 'User', role: 'USER', status: 'ACTIVE',
    sessionVersion: 2, createdAt: now.toISOString(),
  });

  const offer = offerFromRow({ id: 'o1', job_id: 'j1', provider_id: 'p1', price: '12.5', message: 'ok', status: 'PENDING', created_at: now, updated_at: now });
  assert.equal(offer.price, 12.5);
  assert.equal(offer.jobId, 'j1');

  const payment = paymentFromRow({ id: 'p1', job_id: 'j1', payer_id: 'u1', payee_id: 'u2', amount: '19.9', status: 'HELD', provider_ref: null, idempotency_key: null, created_at: now, updated_at: now });
  assert.equal(payment.amount, 19.9);
  assert.equal(payment.idempotencyKey, '');

  const application = applicationFromRow({ id: 'a1', job_id: 'j1', candidate_id: 'u2', resume_text: null, skills: null, status: 'PENDING', created_at: now, updated_at: now });
  assert.equal(application.resumeText, '');
  assert.equal(application.skills, '');

  const candidate = employerCandidateFromRow({ id: 'a1', resume_text: null, skills: null, status: 'FORWARDED', created_at: now, updated_at: now });
  assert.equal(candidate.resumeText, '');
  assert.equal(candidate.status, 'FORWARDED');

  const vertical = verticalFromRow({ id: 'v1', slug: 'vehicles', name: 'Vehicles', name_en: null, description: null, config: undefined, is_active: false, sort_order: '4' });
  assert.deepEqual(vertical, {
    id: 'v1', slug: 'vehicles', name: 'Vehicles', nameEn: '', description: '', config: {}, isActive: false, sortOrder: 4,
  });
});

test('payment policy validates idempotency and maps mutation errors', () => {
  assert.equal(validateIdempotencyPair({ headerKey: '  abc-123 ', bodyKey: 'abc-123', maxLength: 50 }), 'abc-123');
  assert.equal(validateIdempotencyPair({ headerKey: '', bodyKey: 'xyz', maxLength: 50 }), 'xyz');
  assertHttpError(() => validateIdempotencyPair({ bodyKey: 'x'.repeat(51), maxLength: 50 }), 'INVALID_IDEMPOTENCY_KEY');
  assertHttpError(() => validateIdempotencyPair({ bodyKey: 'bad space', maxLength: 50 }), 'INVALID_IDEMPOTENCY_KEY');
  assertHttpError(() => validateIdempotencyPair({ headerKey: 'a', bodyKey: 'b', maxLength: 50 }), 'INVALID_IDEMPOTENCY_KEY');

  assert.equal(paymentAmountForJob({ kind: 'JOB', monthlySalary: 2000, budgetMax: 1000, budgetMin: 500 }), 2000);
  assert.equal(paymentAmountForJob({ kind: 'JOB', monthlySalary: 0, budgetMax: 1000, budgetMin: 500 }), 1000);
  assert.equal(paymentAmountForJob({ kind: 'MISSION', budgetMax: 900, budgetMin: 500 }), 900);
  assert.equal(paymentAmountForJob({ kind: 'MISSION', budgetMax: 0, budgetMin: 500 }), 500);
  assertHttpError(() => paymentAmountForJob({ kind: 'MISSION', budgetMax: 0, budgetMin: 0 }), 'INVALID_AMOUNT');

  const codes = [
    'PAYMENT_ALREADY_EXISTS', 'IDEMPOTENCY_CONFLICT', 'INVALID_OFFER_STATE',
    'INVALID_STATE', 'INVALID_PAYMENT_STATE', 'PARTIAL_REFUND_UNSUPPORTED',
  ];
  for (const code of codes) assert.equal(mapPaymentMutationError({ code }).code, code);
  const passthrough = new Error('unexpected');
  assert.equal(mapPaymentMutationError(passthrough), passthrough);
});

test('payment webhook signature and body normalization enforce supported events', () => {
  const secret = 'test-secret';
  const raw = '{"eventId":"e1"}';
  const signature = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
  assert.equal(verifyPaymentWebhookSignature(raw, signature, secret, { requireTimestamp: false }), true);
  assert.equal(verifyPaymentWebhookSignature(raw, 'sha256=deadbeef', secret, { requireTimestamp: false }), false);
  assert.equal(verifyPaymentWebhookSignature(raw, signature, '', { requireTimestamp: false }), false);

  const requireFields = (body, fields) => {
    for (const field of fields) assert.ok(body[field] !== undefined, `missing ${field}`);
  };
  const enumField = (value, set) => {
    assert.ok(set.has(value));
    return value;
  };
  const body = normalizePaymentWebhookBody({ eventId: 'e1', eventType: 'PAYMENT_HELD', paymentId: 'p1', providerRef: 'ref' }, { requireFields, enumField });
  assert.deepEqual(body, {
    eventId: 'e1', eventType: 'PAYMENT_HELD', paymentId: 'p1', providerRef: 'ref',
    payload: { eventId: 'e1', eventType: 'PAYMENT_HELD', paymentId: 'p1', providerRef: 'ref' },
  });
});

test('local payment webhook handles duplicate, held, released and refunded transitions', async () => {
  const state = {
    paymentWebhooks: [],
    payments: [
      { id: 'p-held', jobId: 'j-held', status: 'HOLD_PENDING', amount: 100, currency: 'EUR' },
      { id: 'p-release', jobId: 'j-release', status: 'RELEASE_PENDING', amount: 100, currency: 'EUR' },
      { id: 'p-refund', jobId: 'j-refund', status: 'REFUND_PENDING', amount: 100, currency: 'EUR' },
    ],
    jobs: [
      { id: 'j-release', status: 'COMPLETED', updatedAt: null },
    ],
    ledgerEntries: [],
    settlements: [],
  };
  let seq = 0;
  const db = {
    collection: state,
    id: () => `id-${++seq}`,
    insert: (collection, row) => state[collection].push(row),
    touch: () => {},
  };
  const withTransaction = async (fn) => fn();
  const config = { paymentCurrency: 'EUR' };
  const nowFn = () => now;
  const releaseJournal = (b) => [{ account: 'buyer', debit: b.employerCharge, credit: 0 }];
  const payoutJournal = (b) => [{ account: 'seller', debit: 0, credit: b.providerPayout }];

  const held = await applyLocalPaymentWebhook({
    event: { eventId: 'e-held', eventType: 'PAYMENT_HELD', paymentId: 'p-held', providerRef: 'r-held', payload: {} },
    db, withTransaction, config, releaseJournal, payoutJournal, now: nowFn,
  });
  assert.equal(held.paymentId, 'p-held');
  assert.equal(state.payments[0].status, 'HELD');

  const released = await applyLocalPaymentWebhook({
    event: { eventId: 'e-release', eventType: 'PAYMENT_RELEASED', paymentId: 'p-release', providerRef: 'r-release', payload: {} },
    db, withTransaction, config, releaseJournal, payoutJournal, now: nowFn,
  });
  assert.equal(released.paymentId, 'p-release');
  assert.equal(state.payments[1].status, 'RELEASED');
  assert.equal(state.jobs[0].status, 'SETTLED');
  assert.equal(state.ledgerEntries.length, 2);
  assert.equal(state.settlements.length, 1);

  const refunded = await applyLocalPaymentWebhook({
    event: { eventId: 'e-refund', eventType: 'PAYMENT_REFUNDED', paymentId: 'p-refund', providerRef: '', payload: {} },
    db, withTransaction, config, releaseJournal, payoutJournal, now: nowFn,
  });
  assert.equal(refunded.paymentId, 'p-refund');
  assert.equal(state.payments[2].status, 'REFUNDED');

  const duplicate = await applyLocalPaymentWebhook({
    event: { eventId: 'e-held', eventType: 'PAYMENT_HELD', paymentId: 'p-held', providerRef: 'r-held', payload: {} },
    db, withTransaction, config, releaseJournal, payoutJournal, now: nowFn,
  });
  assert.deepEqual(duplicate, { processed: true, duplicate: true, paymentId: 'p-held' });

  const missing = await applyLocalPaymentWebhook({
    event: { eventId: 'e-missing', eventType: 'PAYMENT_HELD', paymentId: 'does-not-exist', providerRef: '', payload: {} },
    db, withTransaction, config, releaseJournal, payoutJournal, now: nowFn,
  });
  assert.deepEqual(missing, { processed: true, duplicate: false, paymentId: null });
});

test('database runtime exposes safe no-pool behavior', async () => {
  if (getPool() !== null) return;
  assert.equal(getPool(), null);
  assert.deepEqual(await databaseHealth(), { mode: 'file', status: 'ok' });
  assert.deepEqual(await withSqlTransaction(async (client) => ({ client })), { client: null });
  await closePool();
});

test('migration orchestrator loads, checksums, applies and rolls back migrations deterministically', async () => {
  const { loadMigrations, checksumMigration, migrationStatus, assertNoDrift, runMigrations, rollbackLastMigration } = await import('../src/db/migrations.js');
  const migrations = await loadMigrations();
  assert.equal(migrations.length, 4);
  assert.deepEqual(migrations.map((m) => m.version), [1, 2, 3, 4]);
  for (const migration of migrations) assert.match(checksumMigration(migration), /^[0-9a-f]{64}$/);

  const applied = new Map();
  const client = {
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      if (text.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) return { rows: [], rowCount: 0 };
      if (text === 'SELECT pg_advisory_lock($1)' || text === 'SELECT pg_advisory_unlock($1)') return { rows: [], rowCount: 0 };
      if (text.startsWith('SELECT version, name, checksum, applied_at, execution_ms FROM schema_migrations')) {
        return { rows: [...applied.values()] };
      }
      if (text.startsWith('SELECT version, name FROM schema_migrations WHERE version >')) return { rows: [] };
      if (text === 'SELECT version, name FROM schema_migrations') return { rows: [...applied.values()].map(({ version, name }) => ({ version, name })) };
      if (text.startsWith('SELECT version, name, checksum FROM schema_migrations ORDER BY version DESC LIMIT 1')) {
        const rows = [...applied.values()].sort((a, b) => b.version - a.version);
        return { rows: rows.slice(0, 1), rowCount: rows.length ? 1 : 0 };
      }
      if (text.startsWith('DELETE FROM schema_migrations WHERE version=')) {
        applied.delete(Number(params[0]));
        return { rows: [], rowCount: 1 };
      }
      if (text.startsWith('INSERT INTO schema_migrations')) {
        const [version, name, checksum, executionMs] = params;
        applied.set(version, { version, name, checksum, applied_at: now, execution_ms: executionMs });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  const initial = await migrationStatus(client);
  assert.ok(initial.every((row) => row.state === 'pending'));
  await assertNoDrift(client);
  const appliedStatus = await runMigrations(client);
  assert.ok(appliedStatus.every((row) => row.state === 'applied'));
  assert.equal(applied.size, migrations.length);
  const driftCheck = await assertNoDrift(client);
  assert.ok(driftCheck.every((row) => row.state === 'applied'));

  const rolled = await rollbackLastMigration(client);
  assert.equal(rolled.version, 4);
  assert.equal(applied.size, 3);
  const afterRollback = await migrationStatus(client);
  assert.equal(afterRollback.find((row) => row.version === 4).state, 'pending');
});

test('repository boundary methods fail closed when PostgreSQL pool is unavailable', async () => {
  const moduleFiles = [
    'admin.js','analytics.js','applications.js','auth.js','context.js','core.js','notifications.js',
    'outbox.js','payment_funding.js','payment_lifecycle.js','payment_queries.js','payment_refunds.js',
    'payment_webhooks.js','privacy.js','saved_searches.js','storage.js','trust.js','views.js',
  ];
  for (const file of moduleFiles) {
    const mod = await import(`../src/repository/${file}`);
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function') continue;
      let args = Array.from({ length: fn.length }, () => undefined);
      if (file === 'admin.js' && name === 'moderateJob') args = ['job-id', 'DRAFT'];
      if (file === 'trust.js' && name === 'listCandidatesForComparison') args = ['job-id', ['application-id']];
      await assert.rejects(
        Promise.resolve().then(() => fn(...args)),
        (error) => {
          assert.ok(error instanceof Error, `${file}:${name} must fail rather than resolve without its SQL dependency`);
          assert.notEqual(error?.code, 'ECONNREFUSED', `${file}:${name} must not attempt an unavailable network database`);
          return true;
        },
        `${file}:${name} must fail rather than silently succeed without PostgreSQL`,
      );
    }
  }
});
