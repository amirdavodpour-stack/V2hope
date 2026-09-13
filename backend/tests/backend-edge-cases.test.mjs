import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_RETRY_BASE_MS = '0';
process.env.PAYMENT_PROVIDER_MAX_ATTEMPTS = '3';
process.env.PAYMENT_PROVIDER_TOKEN = 'edge-payment-token-0123456789';
process.env.PAYMENT_PROVIDER_CREATE_URL = 'https://edge.invalid/create';
process.env.PAYMENT_PROVIDER_RELEASE_URL = 'https://edge.invalid/release';
process.env.PAYMENT_PROVIDER_REFUND_URL = 'https://edge.invalid/refund';
process.env.NOTIFICATION_RETRY_BASE_MS = '0';
process.env.NOTIFICATION_MAX_ATTEMPTS = '3';
process.env.NOTIFICATION_PROVIDER_TOKEN = 'edge-notification-token-0123456789';
process.env.MAX_REQUEST_BYTES = '1024';
process.env.STORAGE_BACKEND = 'local';
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'hope-edge-'));
process.env.STORAGE_DIR = temp;

const {
  anonymousId, normalizeEvent, normalizeCrash,
} = await import('../src/analytics.js');
const { sanitizeTelemetryProperties } = await import('../src/privacy.js');
const { haversineKm, parseCoordinate } = await import('../src/application/geo.js');
const { evaluateRecommendationRanking, buildCandidateProfile } = await import('../src/recommendation.js');
const { businessHealth } = await import('../src/business_metrics.js');
const { createPaymentProvider } = await import('../src/payment_provider.js');
const { deliverNotification } = await import('../src/notification_provider.js');
const { readBody } = await import('../src/http.js');
const { storage } = await import('../src/storage.js');

function requestFrom(chunks, headers = {}) {
  const req = Readable.from(chunks);
  req.headers = headers;
  return req;
}

async function withFetch(fake, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test('analytics normalization is deterministic, bounded, and fail-closed', () => {
  assert.equal(anonymousId(' device-A '), anonymousId('device-A'));
  assert.equal(anonymousId(''), null);

  const long = 'x'.repeat(1000);
  const event = normalizeEvent({
    eventName: 'search_viewed',
    platform: 'android',
    anonymousId: 'device-A',
    sessionId: long,
    appVersion: long,
    properties: {a: long, nested: {ok: true}},
  }, 'user-1');
  assert.equal(event.platform, 'ANDROID');
  assert.equal(event.userId, 'user-1');
  assert.equal(event.sessionId.length, 128);
  assert.equal(event.appVersion.length, 64);
  assert.equal(event.properties.a.length, 256);
  assert.equal(event.properties.nested.ok, true);

  assert.throws(() => normalizeEvent({eventName: 'bad space', platform: 'WEB'}), /Invalid eventName/);
  assert.throws(() => normalizeEvent({eventName: 'ok', platform: 'LINUX'}), /Invalid platform/);
  assert.throws(() => normalizeEvent({eventName: 'ok', platform: 'WEB', occurredAt: 'not-a-date'}), /Invalid occurredAt/);
});

test('telemetry sanitizer drops direct sensitive fields and preserves primitive analytics values', () => {
  const result = sanitizeTelemetryProperties({
    email: 'person@example.com',
    phone: '+123',
    ok: 'value',
    count: 3,
    enabled: true,
    nested: {secret: 'drop-me'},
    nullish: null,
  });
  assert.equal(result.email, undefined);
  assert.equal(result.phone, undefined);
  assert.equal(result.ok, 'value');
  assert.equal(result.count, 3);
  assert.equal(result.enabled, true);
  assert.equal(result.nested, undefined);
  assert.equal(result.nullish, null);
});

test('crash normalization redacts credentials and validates fingerprint/platform', () => {
  const crash = normalizeCrash({
    message: 'boom for person@example.com token=supersecret',
    stack: 'Authorization: Bearer abc123 password=hunter2',
    fingerprint: 'fp-12345678',
    platform: 'ios',
    releaseChannel: 'stable',
  }, 'u1');
  assert.equal(crash.platform, 'IOS');
  assert.equal(crash.message.includes('person@example.com'), false);
  assert.equal(crash.message.includes('supersecret'), false);
  assert.equal(crash.stack.includes('Bearer abc123'), false);
  assert.equal(crash.stack.includes('hunter2'), false);
  assert.throws(() => normalizeCrash({message:'x', fingerprint:'short', platform:'IOS'}), /Invalid crash fingerprint/);
  assert.throws(() => normalizeCrash({message:'x', fingerprint:'fp-12345678', platform:'linux'}), /Invalid platform/);
});

test('geo helpers handle numeric strings, invalid coordinates, and zero-distance', () => {
  assert.equal(parseCoordinate('35.7', 'lat'), 35.7);
  assert.throws(() => parseCoordinate('hello', 'lat'), /lat must be numeric/);
  assert.throws(() => parseCoordinate('91', 'lat'), (error) => error?.code === 'INVALID_COORDINATE' && /out of range/.test(error.message));
  assert.throws(() => parseCoordinate('181', 'lng'), (error) => error?.code === 'INVALID_COORDINATE' && /out of range/.test(error.message));
  assert.equal(parseCoordinate('-180', 'lng'), -180);
  assert.equal(haversineKm(35.0, 51.0, 35.0, 51.0), 0);
  const distance = haversineKm(0, 0, 0, 1);
  assert.ok(distance > 111 && distance < 112);
});

test('recommendation ranking handles empty relevance and bounded k', () => {
  const items = [
    {id:'1', recommendationReasons:['match']},
    {id:'2', recommendationReasons:[]},
  ];
  const empty = evaluateRecommendationRanking(items, () => false, 0);
  assert.equal(empty.k, 10);
  assert.equal(empty.hits, 0);
  assert.equal(empty.precisionAtK, 0);
  assert.equal(empty.recallAtK, 0);
  assert.equal(empty.ndcgAtK, 1);
  assert.equal(empty.reasonCoverage, 0.5);

  const profile = buildCandidateProfile([
    {status:'FORWARDED', jobKind:'MISSION', skills:['JS','SQL']},
    {status:'REJECTED', jobKind:'JOB', skills:['sql']},
  ]);
  assert.equal(profile.skills.has('js'), true);
  assert.equal(profile.skills.has('sql'), true);
});

test('business health exposes warning/critical thresholds without false positives at zero traffic', () => {
  assert.deepEqual(businessHealth(), {
    errorRate5xx: 0, slowRequestRate: 0, alerts: [],
  });
  const warning = businessHealth({requests:100, errors5xx:1, requestDurationBuckets:{fast:80, gte500:20}});
  assert.equal(warning.alerts.some(x => x.code === 'HTTP_5XX_RATE_ELEVATED'), true);
  assert.equal(warning.alerts.some(x => x.code === 'SLOW_REQUEST_RATE_HIGH'), true);
  const critical = businessHealth({requests:100, errors5xx:2});
  assert.equal(critical.alerts[0].severity, 'critical');
});

test('payment simulator supports stable refund semantics', async () => {
  const provider = createPaymentProvider('simulator');
  const refundA = await provider.refundHold({paymentId:'p1', providerRef:'ref-1', idempotencyKey:'refund-1'});
  const refundB = await provider.refundHold({paymentId:'p1', providerRef:'ref-1', idempotencyKey:'refund-1'});
  assert.equal(refundA.status, 'REFUNDED');
  assert.equal(refundA.refundRef, refundB.refundRef);
  assert.equal(refundB.idempotent, true);
});

test('payment webhook adapter retries retryable responses and rejects malformed provider responses', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    if (calls === 1) return new Response('', {status: 503});
    return new Response(JSON.stringify({providerRef:'hold-1', status:'HELD'}), {status:200});
  }, async () => {
    const provider = createPaymentProvider('webhook');
    const result = await provider.createHold({paymentId:'p2', amount:100, idempotencyKey:'hold-2'});
    assert.equal(result.providerRef, 'hold-1');
    assert.equal(calls, 2);
  });

  await withFetch(async () => new Response(JSON.stringify({providerRef:'only-ref'}), {status:200}), async () => {
    const provider = createPaymentProvider('webhook');
    await assert.rejects(() => provider.createHold({paymentId:'p3', amount:100}), /PAYMENT_PROVIDER_INVALID_CREATE_RESPONSE/);
  });
});

test('notification provider rejects unsafe URLs before fetch and retries transient responses', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    if (calls === 1) return new Response('', {status: 502});
    return new Response('', {status: 200});
  }, async () => {
    const result = await deliverNotification({
      url:'https://notify.invalid/send',
      payload:{notificationId:'n1', userId:'u1'},
      idempotencyKey:'n1-key',
    });
    assert.deepEqual(result, {status:200, attempts:2});
    assert.equal(calls, 2);
  });
  await assert.rejects(() => deliverNotification({url:'http://notify.invalid/send', payload:{}}), /NOTIFICATION_PROVIDER_HTTPS_REQUIRED/);
  await assert.rejects(() => deliverNotification({url:'not-a-url', payload:{}}), /NOTIFICATION_PROVIDER_URL_INVALID/);
  await withFetch(async () => new Response('', {status:400}), async () => {
    await assert.rejects(() => deliverNotification({url:'https://notify.invalid/send', payload:{}}), /NOTIFICATION_PROVIDER_HTTP_400/);
  });
});

test('HTTP body parser enforces JSON media type and request size', async () => {
  const valid = await readBody(requestFrom([Buffer.from('{"ok":true}')], {'content-type':'application/json'}));
  assert.deepEqual(valid, {ok:true});
  assert.equal(await readBody(requestFrom([], {'content-type':'application/json'})), null);
  await assert.rejects(() => readBody(requestFrom([Buffer.from('nope')], {'content-type':'application/json'})), (error) => error?.code === 'INVALID_JSON');
  await assert.rejects(() => readBody(requestFrom([Buffer.from('{}')], {'content-type':'text/plain'})), (error) => error?.code === 'UNSUPPORTED_MEDIA_TYPE');
  await assert.rejects(() => readBody(requestFrom([Buffer.from('x'.repeat(2000))], {'content-type':'application/json'})), (error) => error?.code === 'BODY_TOO_LARGE');
});

test('local storage moves uploaded files atomically and rejects direct-upload APIs', async () => {
  const source = path.join(temp, 'source.txt');
  await fs.writeFile(source, 'hello');
  const result = await storage.put({path: source, key:'unit-sample.txt', contentType:'text/plain'});
  assert.equal(result.key, 'unit-sample.txt');
  assert.equal(await fs.readFile(path.join((await import('../src/config.js')).config.storageDir, 'unit-sample.txt'), 'utf8'), 'hello');
  await assert.rejects(() => storage.presignPut({key:'x', contentType:'text/plain', expiresIn:60}), /DIRECT_UPLOAD_UNSUPPORTED/);
  await assert.rejects(() => storage.head({key:'x'}), /DIRECT_UPLOAD_UNSUPPORTED/);
  await assert.rejects(() => storage.validateObject({key:'x', contentType:'text/plain'}), /DIRECT_UPLOAD_UNSUPPORTED/);
  await storage.delete({key:'unit-sample.txt'});
  await assert.rejects(() => fs.access(path.join(temp, 'unit-sample.txt')));
  await storage.delete({key:'does-not-exist'});
});

after(async () => {
  await fs.rm(temp, {recursive:true, force:true});
});
