import crypto from 'node:crypto';
import { randomToken, sha256, signAccessToken, verifyAccessToken } from '../security.js';
import { HttpError } from '../api/http_error.js';

export function createSessionService({ config, repo, logEvent, now, legacy }) {
  const getUserById = async (id) => process.env.DATABASE_URL ? repo.findUserById(id) : legacy.findUserById(id);
  const getUserByEmail = async (email) => process.env.DATABASE_URL ? repo.findUserByEmail(email) : legacy.findUserByEmail(email);

  async function authUser(req) {
    const raw = String(req.headers.authorization || '');
    if (!raw.startsWith('Bearer ')) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
    try {
      const payload = verifyAccessToken(raw.slice(7), config.accessSecret, {
        issuer: config.accessIssuer,
        audience: config.accessAudience,
      });
      const user = await getUserById(payload.sub);
      if (!user || user.status !== 'ACTIVE') throw new Error('User not active');
      if (Number(payload.sv || 0) !== Number(user.sessionVersion || 0)) throw new Error('Session revoked');
      return user;
    } catch {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
    }
  }

  async function issueSession(user, familyId) {
    familyId = familyId || legacy.id();
    const refresh = randomToken(48);
    const token = {
      id: legacy.id(), userId: user.id, tokenHash: sha256(refresh), familyId,
      expiresAt: new Date(Date.now() + config.refreshTtlSeconds * 1000).toISOString(),
      createdAt: now(), revokedAt: null, replacedBy: null,
    };
    if (process.env.DATABASE_URL) await repo.insertRefreshToken(token);
    else legacy.insertRefreshToken(token);
    return {
      accessToken: signAccessToken(
        { sub: user.id, role: user.role, sv: Number(user.sessionVersion || 0) },
        config.accessSecret,
        config.accessTtlSeconds,
        { issuer: config.accessIssuer, audience: config.accessAudience },
      ),
      refreshToken: refresh,
    };
  }

  async function deliverPasswordReset({ user, token }) {
    const mode = config.resetDeliveryMode;
    if (mode === 'console') {
      // Test/development delivery must never put bearer-equivalent reset tokens into logs.
      logEvent({ level: 'info', action: 'PASSWORD_RESET_DELIVERY', userId: user.id, delivery: 'console' });
      return;
    }
    if (mode === 'webhook') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.resetDeliveryTimeoutMs);
      timeout.unref?.();
      try {
        const eventId = crypto.randomUUID();
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ type: 'password_reset', userId: user.id, email: user.email, token, expiresInSeconds: config.resetTokenTtlSeconds, eventId, timestamp });
        const signature = `sha256=${crypto.createHmac('sha256', config.resetDeliverySecret).update(`${timestamp}.${eventId}.${payload}`).digest('hex')}`;
        const response = await fetch(config.resetDeliveryUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-hope-reset-timestamp': String(timestamp), 'x-hope-reset-event-id': eventId, 'x-hope-reset-signature': signature },
          body: payload,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Reset delivery returned HTTP ${response.status}`);
      } finally {
        clearTimeout(timeout);
      }
      return;
    }
    throw new Error('Unsupported reset delivery mode');
  }

  return { getUserById, getUserByEmail, authUser, issueSession, deliverPasswordReset };
}
