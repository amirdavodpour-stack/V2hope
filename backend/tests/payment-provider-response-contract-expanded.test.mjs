import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PAYMENT_PROVIDER_TOKEN = 'test-token-with-more-than-24-chars';
process.env.PAYMENT_PROVIDER_CREATE_URL = 'https://psp.example.test/hold';
process.env.PAYMENT_PROVIDER_RELEASE_URL = 'https://psp.example.test/release';
process.env.PAYMENT_PROVIDER_REFUND_URL = 'https://psp.example.test/refund';
process.env.PAYMENT_PROVIDER_RETRY_BASE_MS = '0';
process.env.PAYMENT_PROVIDER_MAX_ATTEMPTS = '3';
const { createPaymentProvider } = await import('../src/payment_provider.js');

async function withFetch(sequence, fn) {
  const original = globalThis.fetch;
  const requests = [];
  let index = 0;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, headers: { ...options.headers }, body: options.body });
    const step = sequence[Math.min(index++, sequence.length - 1)];
    return new Response(step.body ?? '', { status: step.status, headers: { 'content-type': 'application/json' } });
  };
  try { return await fn(requests); } finally { globalThis.fetch = original; }
}

test('malformed success response is rejected and is not retried', async () => {
  await withFetch([{ status: 200, body: JSON.stringify({ status: 'HELD' }) }], async (requests) => {
    const provider = createPaymentProvider('webhook');
    await assert.rejects(
      provider.createHold({ paymentId: 'provider-bad-create', amount: 100, currency: 'EUR', idempotencyKey: 'provider-create-1' }),
      /PAYMENT_PROVIDER_INVALID_CREATE_RESPONSE/,
    );
    assert.equal(requests.length, 1);
  });
});

test('malformed JSON from provider is rejected and is not retried', async () => {
  await withFetch([{ status: 200, body: '{not-json' }], async (requests) => {
    const provider = createPaymentProvider('webhook');
    await assert.rejects(
      provider.releaseHold({ paymentId: 'provider-bad-json', providerRef: 'PSP-1', idempotencyKey: 'provider-release-1' }),
      /PAYMENT_PROVIDER_INVALID_JSON/,
    );
    assert.equal(requests.length, 1);
  });
});

test('retryable 429 keeps the same idempotency key across attempts', async () => {
  await withFetch([
    { status: 429, body: JSON.stringify({ error: 'busy' }) },
    { status: 200, body: JSON.stringify({ status: 'HELD', providerRef: 'PSP-429' }) },
  ], async (requests) => {
    const provider = createPaymentProvider('webhook');
    const result = await provider.createHold({ paymentId: 'provider-429', amount: 200, currency: 'EUR', idempotencyKey: 'provider-stable-key' });
    assert.equal(result.providerRef, 'PSP-429');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].headers['idempotency-key'], 'provider-stable-key');
    assert.equal(requests[1].headers['idempotency-key'], 'provider-stable-key');
  });
});
