#!/usr/bin/env node
/**
 * HOPE staging notification-delivery gate.
 *
 * WHY THIS EXISTS
 * ---------------
 * `provider_runtime` was previously driven only by `staging-product-smoke.mjs`,
 * which exercises the PAYMENT provider. The notification provider was covered
 * only by `notification-provider-integration.test.mjs`, which talks to a local
 * 127.0.0.1 stub — so it proved wiring, never real delivery. This script adds the
 * missing runtime leg so `provider_runtime` is genuinely provable in CI.
 *
 * WHAT IT PROVES (read this before trusting the gate)
 * --------------------------------------------------
 * 1. IN-APP RECORD: a real, notification-producing business event is driven
 *    through the staging API (applicant applies to a JOB -> the job owner is
 *    notified) and the notification record is then observed via
 *    `GET /notifications`. Proves the staging deployment actually creates and
 *    persists the notification.
 * 2. PROVIDER REACHABLE AND AUTHENTICATING: the configured provider endpoint(s)
 *    are called directly with the SAME payload shape, `authorization: Bearer`
 *    and `idempotency-key` headers that `backend/src/notification_provider.js`
 *    sends, and must answer 2xx. Proves the endpoint is real, reachable over
 *    HTTPS, accepts the production payload contract and accepts the token.
 * 3. NO DELIVERY FAILURE ON STAGING: `/metrics` is read before and after; the
 *    staging outbox must have drained (`outboxProcessed` increased) and
 *    `categoryFailures.push` / `.email` must NOT have increased. Proves staging's
 *    own dispatch of this notification did not fail.
 *
 * WHAT IT DOES NOT PROVE (deliberately stated, not glossed over)
 * -------------------------------------------------------------
 * - It does not prove a human received a push or an email. Only the provider can
 *   attest final delivery, and the provider's receipt API is not modelled here.
 * - `recordOutboxProcessed()` in `backend/src/outbox_handlers.js` is also called
 *   on the NOTIFICATION_PROVIDER_NOT_CONFIGURED and NOTIFICATION_NO_TARGET
 *   paths, so a rising `outboxProcessed` alone is NOT delivery. That is exactly
 *   why assertion 2 exists and why assertion 3 is written as "no failure", not
 *   as "delivery happened".
 *
 * HONEST SKIP
 * -----------
 * If STAGING_BASE_URL is absent, or NOTIFICATION_PROVIDER_TOKEN plus at least
 * one of NOTIFICATION_PUSH_URL / NOTIFICATION_EMAIL_URL is absent, this script
 * exits 78 (EX_CONFIG) WITHOUT asserting anything. The workflow treats that as a
 * skip, so no evidence is written and `provider_runtime` stays unproven. It never
 * reports success for a run it did not perform.
 *
 * Exit codes: 0 = all assertions held, 1 = an assertion failed, 78 = skipped
 * (not configured).
 */

import assert from 'node:assert/strict';

const EXIT_SKIP = 78;
const TOTAL_BUDGET_MS = Number(process.env.NOTIFICATION_GATE_TIMEOUT_MS || 120_000);
const POLL_INTERVAL_MS = 2_000;
const startedAt = Date.now();

const env = process.env;
const baseUrl = (env.STAGING_BASE_URL || env.STAGING_API_BASE_URL || '').replace(/\/+$/, '');
const pushUrl = env.NOTIFICATION_PUSH_URL || '';
const emailUrl = env.NOTIFICATION_EMAIL_URL || '';
const providerToken = env.NOTIFICATION_PROVIDER_TOKEN || '';
const metricsToken = env.STAGING_METRICS_TOKEN || '';

function skip(reason) {
  process.stderr.write(`notification-delivery gate SKIPPED: ${reason}\n`);
  process.stderr.write('No evidence will be written; provider_runtime stays unproven.\n');
  process.exit(EXIT_SKIP);
}

function remainingMs() {
  return TOTAL_BUDGET_MS - (Date.now() - startedAt);
}

function log(step, detail) {
  process.stdout.write(`[notification-delivery] ${step}${detail ? `: ${detail}` : ''}\n`);
}

async function request(pathname, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(Math.max(5_000, Math.min(30_000, remainingMs()))),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function expectStatus(res, expected, what) {
  assert.equal(
    res.status,
    expected,
    `${what}: expected HTTP ${expected}, got ${res.status} — ${res.text.slice(0, 400)}`,
  );
  return res.json;
}

async function readMetrics(label) {
  const res = await request('/metrics', { headers: metricsToken ? { 'x-metrics-token': metricsToken } : {} });
  const snapshot = expectStatus(res, 200, `metrics read (${label})`);
  return {
    outboxProcessed: Number(snapshot.outboxProcessed ?? 0),
    outboxFailed: Number(snapshot.outboxFailed ?? 0),
    push: Number(snapshot.categoryFailures?.push ?? 0),
    email: Number(snapshot.categoryFailures?.email ?? 0),
  };
}

/** Payload shapes copied from backend/src/outbox_handlers.js so the contract matches. */
function canaryPayload(channel, notificationId, userId) {
  const common = { notificationId, userId, title: 'HOPE CI delivery canary', data: { canary: true } };
  return channel === 'PUSH'
    ? {
        ...common,
        token: `hope-ci-canary-${notificationId}`,
        platform: 'ANDROID',
        body: 'Automated staging-certification delivery probe.',
      }
    : {
        ...common,
        to: `ci-canary+${notificationId}@hope.invalid`,
        subject: common.title,
        text: 'Automated staging-certification delivery probe.',
      };
}

async function probeProvider(channel, url, notificationId, userId) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${providerToken}`,
      'idempotency-key': `notification:${notificationId}:${channel}:ci-canary`,
    },
    body: JSON.stringify(canaryPayload(channel, notificationId, userId)),
    signal: AbortSignal.timeout(Math.max(5_000, Math.min(30_000, remainingMs()))),
  });
  const text = await res.text();
  assert.ok(
    res.status >= 200 && res.status < 300,
    `${channel} provider at ${new URL(url).origin} rejected the production payload contract: ` +
      `HTTP ${res.status} — ${text.slice(0, 300)}`,
  );
  log(`${channel} provider accepted the canary`, `HTTP ${res.status}`);
  return res.status;
}

async function main() {
  // ---- honest skip -------------------------------------------------------
  if (!baseUrl) skip('STAGING_BASE_URL is not set');
  if (!/^https:\/\//.test(baseUrl)) skip(`STAGING_BASE_URL is not HTTPS (${baseUrl})`);
  if (!providerToken) skip('NOTIFICATION_PROVIDER_TOKEN is not set');
  if (!pushUrl && !emailUrl) skip('neither NOTIFICATION_PUSH_URL nor NOTIFICATION_EMAIL_URL is set');
  for (const [name, url] of [['NOTIFICATION_PUSH_URL', pushUrl], ['NOTIFICATION_EMAIL_URL', emailUrl]]) {
    if (url && !/^https:\/\//.test(url)) skip(`${name} is set but not HTTPS`);
  }
  if (!metricsToken) skip('STAGING_METRICS_TOKEN is not set, so staging dispatch cannot be observed');

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `Ci-Notif-${stamp}!aA1`;
  const ownerEmail = `ci-notif-owner-${stamp}@hope.invalid`;
  const applicantEmail = `ci-notif-applicant-${stamp}@hope.invalid`;

  const before = await readMetrics('before');
  log('metrics before', JSON.stringify(before));

  // ---- 1. drive a real notification-producing event ----------------------
  const owner = expectStatus(
    await request('/auth/register', {
      method: 'POST',
      body: { email: ownerEmail, password, fullName: 'CI Notification Owner' },
    }),
    201,
    'register owner',
  );
  const applicant = expectStatus(
    await request('/auth/register', {
      method: 'POST',
      body: { email: applicantEmail, password, fullName: 'CI Notification Applicant' },
    }),
    201,
    'register applicant',
  );
  const ownerToken = owner.token ?? owner.accessToken;
  const applicantToken = applicant.token ?? applicant.accessToken;
  assert.ok(ownerToken && applicantToken, 'staging register did not return access tokens');
  log('registered owner and applicant');

  // A push target must exist, otherwise staging takes the NOTIFICATION_NO_TARGET
  // path and never calls the provider at all.
  expectStatus(
    await request('/notifications/devices', {
      method: 'POST',
      token: ownerToken,
      body: { platform: 'ANDROID', token: `hope-ci-device-${stamp}-000000` },
    }),
    200,
    'register owner push device',
  );
  log('registered a push device for the owner');

  const categories = expectStatus(await request('/categories'), 200, 'categories');
  const categoryId = (Array.isArray(categories) ? categories : categories?.items)?.[0]?.id;
  assert.ok(categoryId, 'no staging categories available to create a JOB');

  const job = expectStatus(
    await request('/jobs', {
      method: 'POST',
      token: ownerToken,
      body: {
        title: `CI notification delivery probe ${stamp}`,
        description: 'Automated staging-certification probe that must produce a notification.',
        acceptanceCriteria: 'The job owner receives a JOB_APPLICATION_RECEIVED notification.',
        categoryId,
        city: 'Tehran',
        kind: 'JOB',
        jobType: 'HOURLY',
        budgetType: 'RANGE',
        budgetMin: 1_000_000,
        budgetMax: 2_000_000,
        schedule: 'FULL_TIME',
        monthlySalary: 90_000_000,
        applicationDeadline: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
      },
    }),
    201,
    'create JOB',
  );
  assert.ok(job?.id, 'staging did not return a job id');
  const publishRes = await request(`/jobs/${job.id}/publish`, { method: 'POST', token: ownerToken });
  assert.ok(
    publishRes.status === 200 || publishRes.status === 201,
    `publish JOB: unexpected HTTP ${publishRes.status} — ${publishRes.text.slice(0, 300)}`,
  );
  log('created and published a JOB', job.id);

  const application = expectStatus(
    await request('/applications', {
      method: 'POST',
      token: applicantToken,
      body: {
        jobId: job.id,
        coverLetter: 'Automated staging-certification notification-delivery probe.',
      },
    }),
    201,
    'apply to JOB',
  );
  log('applicant applied', application?.id ?? '(no id returned)');

  // ---- observe the in-app record ----------------------------------------
  let notification = null;
  while (remainingMs() > POLL_INTERVAL_MS + 5_000) {
    const list = expectStatus(
      await request('/notifications?limit=50', { token: ownerToken }),
      200,
      'list owner notifications',
    );
    const items = Array.isArray(list) ? list : (list.items ?? []);
    notification = items.find((n) => n.type === 'JOB_APPLICATION_RECEIVED') ?? null;
    if (notification) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  assert.ok(
    notification,
    `the owner never received a JOB_APPLICATION_RECEIVED notification within ${TOTAL_BUDGET_MS}ms — ` +
      'staging did not create the notification record',
  );
  assert.ok(notification.id, 'the observed notification has no id');
  log('observed the in-app notification record', notification.id);

  // ---- 2. provider endpoints honour the production contract -------------
  const probed = [];
  if (pushUrl) probed.push(['PUSH', await probeProvider('PUSH', pushUrl, notification.id, owner?.user?.id ?? 'ci')]);
  if (emailUrl) probed.push(['EMAIL', await probeProvider('EMAIL', emailUrl, notification.id, owner?.user?.id ?? 'ci')]);
  assert.ok(probed.length > 0, 'no provider endpoint was probed');

  // ---- 3. staging's own dispatch did not fail ---------------------------
  let after = await readMetrics('after');
  while (after.outboxProcessed <= before.outboxProcessed && remainingMs() > POLL_INTERVAL_MS + 5_000) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    after = await readMetrics('after');
  }
  log('metrics after', JSON.stringify(after));
  assert.ok(
    after.outboxProcessed > before.outboxProcessed,
    `the staging outbox did not drain: outboxProcessed stayed at ${after.outboxProcessed}. ` +
      'The notification was created but never dispatched.',
  );
  assert.equal(
    after.push,
    before.push,
    `staging recorded ${after.push - before.push} new PUSH delivery failure(s) during this run`,
  );
  assert.equal(
    after.email,
    before.email,
    `staging recorded ${after.email - before.email} new EMAIL delivery failure(s) during this run`,
  );

  log(
    'PASS',
    `in-app record observed, ${probed.map(([c, s]) => `${c}=HTTP ${s}`).join(' ')}, ` +
      `outboxProcessed ${before.outboxProcessed}->${after.outboxProcessed}, no push/email failures`,
  );
}

main().catch((error) => {
  process.stderr.write(`notification-delivery gate FAILED: ${error?.message ?? error}\n`);
  process.exitCode = 1;
});
