import crypto from 'node:crypto';

const localWindows = new Map();

function clientKey(req, trustProxy, trustedProxyIps = []) {
  const remote = req.socket?.remoteAddress || 'unknown';
  if (trustProxy && trustedProxyIps.includes(remote)) {
    const chain = String(req.headers?.['x-forwarded-for'] || '')
      .split(',').map((v) => v.trim()).filter(Boolean);
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      if (!trustedProxyIps.includes(chain[i])) return chain[i];
    }
    if (chain[0]) return chain[0];
  }
  return remote;
}

function stableKey(namespace, req, trustProxy, trustedProxyIps) {
  return crypto.createHash('sha256').update(`${namespace}:${clientKey(req, trustProxy, trustedProxyIps)}`).digest('hex');
}

function consumeLocal(key, limit, windowMs) {
  const now = Date.now();
  const current = localWindows.get(key) || { startedAt: now, count: 0 };
  if (now - current.startedAt >= windowMs) { current.startedAt = now; current.count = 0; }
  current.count += 1;
  localWindows.set(key, current);
  if (localWindows.size > 10000) {
    for (const [k, v] of localWindows) if (now - v.startedAt >= windowMs) localWindows.delete(k);
  }
  return current.count <= limit;
}

export function createRateLimiter({ pool, trustProxy, trustedProxyIps = [], onAuthLimited = () => {} } = {}) {
  async function consume(namespace, req, limit, windowMs) {
    const key = stableKey(namespace, req, trustProxy, trustedProxyIps);
    return consumeKey(key, limit, windowMs);
  }

  async function consumeKey(key, limit, windowMs) {
    if (!pool) return consumeLocal(key, limit, windowMs);
    const result = await pool.query({
      text: `
        INSERT INTO rate_limit_windows (key, window_started_at, request_count)
        VALUES ($1, NOW(), 1)
        ON CONFLICT (key) DO UPDATE SET
          request_count = CASE
            WHEN rate_limit_windows.window_started_at <= NOW() - ($2 * INTERVAL '1 millisecond') THEN 1
            ELSE rate_limit_windows.request_count + 1
          END,
          window_started_at = CASE
            WHEN rate_limit_windows.window_started_at <= NOW() - ($2 * INTERVAL '1 millisecond') THEN NOW()
            ELSE rate_limit_windows.window_started_at
          END
        RETURNING request_count
      `,
      values: [key, windowMs],
      query_timeout: Math.min(Math.max(windowMs, 1000), 2000),
    });
    return Number(result.rows[0]?.request_count || 0) <= limit;
  }

  const cleanup = pool ? setInterval(() => {
    pool.query(`DELETE FROM rate_limit_windows WHERE window_started_at < NOW() - INTERVAL '10 minutes'`).catch(() => {});
  }, 300000) : null;
  cleanup?.unref?.();

  return {
    async auth(req, limit, windowMs) {
      const allowed = await consume('auth', req, limit, windowMs);
      if (!allowed) onAuthLimited();
      return allowed;
    },
    async general(req, limit, windowMs) {
      return consume('general', req, limit, windowMs);
    },
    async account(namespace, identity, limit, windowMs) {
      const safeIdentity = crypto.createHash('sha256').update(String(identity)).digest('hex');
      return consumeKey(crypto.createHash('sha256').update(`${namespace}:account:${safeIdentity}`).digest('hex'), limit, windowMs);
    },
  };
}

export function resetLocalRateLimiterForTests() {
  localWindows.clear();
}
