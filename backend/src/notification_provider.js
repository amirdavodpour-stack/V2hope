import { config } from './config.js';

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function retryDelayMs(attempt) {
  const base = config.notificationRetryBaseMs;
  return base <= 0 ? 0 : Math.min(base * (2 ** (attempt - 1)), 2000);
}

function retryableError(error) {
  if (!error) return false;
  if (String(error.message || '').startsWith('NOTIFICATION_PROVIDER_HTTP_')) {
    const status = Number(String(error.message).slice('NOTIFICATION_PROVIDER_HTTP_'.length));
    return RETRYABLE_STATUS.has(status);
  }
  return error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError;
}

export async function deliverNotification({ url, payload, idempotencyKey }) {
  if (!url) throw new Error('NOTIFICATION_PROVIDER_URL_REQUIRED');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('NOTIFICATION_PROVIDER_HTTPS_REQUIRED');
  } catch (error) {
    throw new Error(error.message === 'NOTIFICATION_PROVIDER_HTTPS_REQUIRED' ? error.message : 'NOTIFICATION_PROVIDER_URL_INVALID');
  }
  const body = JSON.stringify(payload ?? {});
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${config.notificationProviderToken}`,
    'idempotency-key': String(idempotencyKey || payload?.notificationId || `${payload?.userId || 'user'}:${Date.now()}`),
  };

  for (let attempt = 1; attempt <= config.notificationMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(config.notificationDeliveryTimeoutMs),
      });
      if (!response.ok) {
        const error = new Error(`NOTIFICATION_PROVIDER_HTTP_${response.status}`);
        if (attempt < config.notificationMaxAttempts && RETRYABLE_STATUS.has(response.status)) {
          const delay = retryDelayMs(attempt);
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
      return { status: response.status, attempts: attempt };
    } catch (error) {
      if (attempt < config.notificationMaxAttempts && retryableError(error)) {
        const delay = retryDelayMs(attempt);
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('NOTIFICATION_PROVIDER_RETRY_EXHAUSTED');
}
