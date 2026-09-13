import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

process.env.PAYMENT_PROVIDER_TOKEN = 'test-token-with-more-than-24-chars';
process.env.PAYMENT_PROVIDER_CREATE_URL = process.env.PAYMENT_PROVIDER_CREATE_URL || 'https://psp.example.test/hold';
process.env.PAYMENT_PROVIDER_RELEASE_URL = process.env.PAYMENT_PROVIDER_RELEASE_URL || 'https://psp.example.test/release';
process.env.PAYMENT_PROVIDER_REFUND_URL = process.env.PAYMENT_PROVIDER_REFUND_URL || 'https://psp.example.test/refund';
process.env.PAYMENT_PROVIDER_RETRY_BASE_MS = '0';
process.env.PAYMENT_PROVIDER_MAX_ATTEMPTS = '3';
const { createPaymentProvider } = await import('../src/payment_provider.js');

test('simulator provider is idempotent for create and release operations', async () => {
  const provider = createPaymentProvider('simulator');
  const createA = await provider.createHold({paymentId:'p1', amount:1250, currency:'EUR', idempotencyKey:'hold-1'});
  const createB = await provider.createHold({paymentId:'p1', amount:1250, currency:'EUR', idempotencyKey:'hold-1'});
  assert.equal(createA.status, 'HELD');
  assert.equal(createA.providerRef, createB.providerRef);
  assert.equal(createA.currency, 'EUR');
  const relA = await provider.releaseHold({paymentId:'p1', providerRef:createA.providerRef, idempotencyKey:'release-1'});
  const relB = await provider.releaseHold({paymentId:'p1', providerRef:createA.providerRef, idempotencyKey:'release-1'});
  assert.equal(relA.status, 'RELEASED');
  assert.equal(relA.providerRef, createA.providerRef);
  assert.equal(relB.idempotent, true);
});

test('webhook provider refuses non-HTTPS endpoints before network access', async () => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    process.env.PAYMENT_PROVIDER='webhook';
    process.env.PAYMENT_PROVIDER_TOKEN='test-token-with-more-than-24-chars';
    process.env.PAYMENT_PROVIDER_CREATE_URL='http://psp.example.test/hold';
    const { createPaymentProvider } = await import(${JSON.stringify(new URL('../src/payment_provider.js', import.meta.url).href)});
    try { await createPaymentProvider('webhook').createHold({paymentId:'p2',amount:100,currency:'USD',idempotencyKey:'hold-2'}); process.exit(2); }
    catch (e) { process.stdout.write(String(e.message)); }
  `], {cwd: process.cwd()});
  let stdout = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0);
  assert.match(stdout, /must use HTTPS|is invalid/i);
});

test('webhook provider retries transient 503 and preserves the idempotency key', async () => {
  const original = globalThis.fetch;
  const requests = [];
  let attempt = 0;
  globalThis.fetch = async (url, options) => {
    requests.push({url, headers: {...options.headers}, body: options.body});
    attempt += 1;
    if (attempt === 1) return new Response(JSON.stringify({error:'temporarily unavailable'}), {status:503, headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({providerRef:'PSP-1', status:'HELD'}), {status:200, headers:{'content-type':'application/json'}});
  };
  try {
    const provider = createPaymentProvider('webhook');
    const result = await provider.createHold({paymentId:'p3', amount:500, currency:'USD', idempotencyKey:'stable-hold-key'});
    assert.equal(result.status, 'HELD');
    assert.equal(attempt, 2);
    assert.equal(requests[0].headers['idempotency-key'], 'stable-hold-key');
    assert.equal(requests[1].headers['idempotency-key'], 'stable-hold-key');
    assert.deepEqual(JSON.parse(requests[1].body), {operation:'createHold', paymentId:'p3', amount:500, currency:'USD', idempotencyKey:'stable-hold-key'});
  } finally { globalThis.fetch = original; }
});
