import crypto from 'node:crypto';
import { config } from './config.js';

function assertHttps(url, label) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error(`${label} must use HTTPS`);
  } catch (error) {
    throw new Error(`${label} is invalid: ${error.message}`);
  }
}

const RETRYABLE_PROVIDER_STATUS = new Set([429, 502, 503, 504]);

function retryDelayMs(attempt) {
  const base = config.paymentProviderRetryBaseMs;
  return base <= 0 ? 0 : Math.min(base * (2 ** (attempt - 1)), 2000);
}

function isRetryableProviderError(error) {
  if (!error) return false;
  if (String(error.message || '').startsWith('PAYMENT_PROVIDER_HTTP_')) {
    const status = Number(String(error.message).slice('PAYMENT_PROVIDER_HTTP_'.length));
    return RETRYABLE_PROVIDER_STATUS.has(status);
  }
  return error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError;
}

async function webhookRequest(endpoint, payload, idempotencyKey) {
  assertHttps(endpoint, 'PAYMENT_PROVIDER endpoint');
  const body = JSON.stringify(payload);
  const headers = {
    'content-type': 'application/json',
    'authorization': `Bearer ${config.paymentProviderToken}`,
    'idempotency-key': String(idempotencyKey || payload.paymentId || crypto.randomUUID()),
  };
  const maxAttempts = config.paymentProviderMaxAttempts;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(config.paymentProviderTimeoutMs),
      });
      const text = await response.text();
      let data = {};
      if (text) {
        try { data = JSON.parse(text); } catch { throw new Error('PAYMENT_PROVIDER_INVALID_JSON'); }
      }
      if (!response.ok) {
        const error = new Error(`PAYMENT_PROVIDER_HTTP_${response.status}`);
        if (attempt < maxAttempts && RETRYABLE_PROVIDER_STATUS.has(response.status)) {
          const delay = retryDelayMs(attempt);
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('PAYMENT_PROVIDER_INVALID_RESPONSE');
      }
      return data;
    } catch (error) {
      if (attempt < maxAttempts && isRetryableProviderError(error)) {
        const delay = retryDelayMs(attempt);
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('PAYMENT_PROVIDER_RETRY_EXHAUSTED');
}

/**
 * Payment provider boundary. `simulator` is test-only. `webhook` is a
 * production adapter for an HTTPS PSP facade owned by the deployment. The
 * facade must implement createHold/releaseHold/refundHold and return the
 * same normalized response fields consumed by the state machine.
 */
export function createPaymentProvider(name = config.paymentProvider) {
  if (name === 'simulator') {
    const released = new Set();
    return {
      name,
      async createHold({ paymentId, amount, currency = 'USD', idempotencyKey }) {
        const stableKey = String(idempotencyKey || paymentId);
        const digest = crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 16);
        return { provider: name, providerRef: `SIM-${paymentId}-${digest}`, status: 'HELD', amount, currency, idempotent: Boolean(idempotencyKey) };
      },
      async releaseHold({ paymentId, providerRef, idempotencyKey }) {
        const stableKey = String(idempotencyKey || paymentId || providerRef);
        const digest = crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 16);
        const releaseRef = `SIM-REL-${providerRef}-${digest}`;
        const alreadyReleased = released.has(releaseRef);
        released.add(releaseRef);
        return { provider: name, providerRef, status: 'RELEASED', idempotent: alreadyReleased, releaseRef };
      },
      async refundHold({ paymentId, providerRef, idempotencyKey }) {
        const stableKey = String(idempotencyKey || paymentId || providerRef);
        const digest = crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 16);
        return { provider: name, providerRef, status: 'REFUNDED', refundRef: `SIM-REF-${providerRef}-${digest}`, idempotent: Boolean(idempotencyKey) };
      },
    };
  }

  if (name === 'webhook') {
    const required = [
      ['PAYMENT_PROVIDER_CREATE_URL', config.paymentProviderCreateUrl],
      ['PAYMENT_PROVIDER_RELEASE_URL', config.paymentProviderReleaseUrl],
      ['PAYMENT_PROVIDER_REFUND_URL', config.paymentProviderRefundUrl],
      ['PAYMENT_PROVIDER_TOKEN', config.paymentProviderToken],
    ];
    for (const [label, value] of required) {
      if (!value) throw new Error(`${label} must be set for webhook payment provider`);
    }
    return {
      name,
      async createHold(args) {
        const data = await webhookRequest(config.paymentProviderCreateUrl, { operation: 'createHold', ...args }, args.idempotencyKey);
        if (String(data.status || '').toUpperCase() !== 'HELD' || !data.providerRef) throw new Error('PAYMENT_PROVIDER_INVALID_CREATE_RESPONSE');
        return data;
      },
      async releaseHold(args) {
        const data = await webhookRequest(config.paymentProviderReleaseUrl, { operation: 'releaseHold', ...args }, args.idempotencyKey);
        if (String(data.status || '').toUpperCase() !== 'RELEASED' || !data.releaseRef) throw new Error('PAYMENT_PROVIDER_INVALID_RELEASE_RESPONSE');
        return data;
      },
      async refundHold(args) {
        const data = await webhookRequest(config.paymentProviderRefundUrl, { operation: 'refundHold', ...args }, args.idempotencyKey);
        if (String(data.status || '').toUpperCase() !== 'REFUNDED' || !data.refundRef) throw new Error('PAYMENT_PROVIDER_INVALID_REFUND_RESPONSE');
        return data;
      },
    };
  }

  throw new Error(`Unsupported PAYMENT_PROVIDER: ${name}`);
}

export const paymentProvider = createPaymentProvider();
