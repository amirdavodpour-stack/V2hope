import { URL } from 'node:url';

export function createAnalyticsRoutes({ authUser, requireAdmin, readBody, sendJson, HttpError, sanitizeTelemetryProperties, recordAnalyticsEvent, recordCrash, logEvent, repo, getProductFunnelSummary, localProductFunnelSummary, legacy }) {
  async function analyticsRoutes(req, res, parts) {
    if (req.method === 'POST' && parts[0] === 'events') {
      const body = await readBody(req);
      let user = null;
      try { user = await authUser(req); } catch (e) { if (e?.status !== 401) throw e; }
      const key = String(req.headers['x-analytics-idempotency-key'] || '').trim().slice(0, 128);
      if (key && !/^[A-Za-z0-9._:-]+$/.test(key)) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Invalid analytics idempotency key');
      const event = await recordAnalyticsEvent({ ...body, properties: sanitizeTelemetryProperties(body?.properties) }, user?.id || null, key);
      return sendJson(res, event.created === false ? 200 : 201, { ok: true, eventName: event.eventName, created: event.created });
    }
    if (req.method === 'POST' && parts[0] === 'crashes') {
      const body = await readBody(req);
      let user = null;
      try { user = await authUser(req); } catch (e) { if (e?.status !== 401) throw e; }
      const crash = await recordCrash(body, user?.id || null);
      logEvent({ level: 'error', action: 'MOBILE_CRASH_REPORTED', fingerprint: crash.fingerprint, platform: crash.platform, appVersion: crash.appVersion, userId: crash.userId || undefined });
      return sendJson(res, 201, { ok: true, id: crash.id });
    }
    throw new HttpError(404, 'NOT_FOUND', 'Analytics route not found');
  }

  async function analyticsAdminRoutes(req, res, parts) {
    requireAdmin(await authUser(req));
    if (req.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'GET required');
    const days = Math.min(Math.max(Number(new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('days') || 30), 1), 365);
    if (parts[0] === 'crashes') {
      return sendJson(res, 200, process.env.DATABASE_URL
        ? await repo.getCrashSummary(days)
        : legacy.crashSummary(days));
    }
    if (parts[0] === 'funnel') return sendJson(res, 200, process.env.DATABASE_URL ? await getProductFunnelSummary(days) : localProductFunnelSummary(days));
    return sendJson(res, 200, process.env.DATABASE_URL
      ? await repo.getAnalyticsSummary(days)
      : legacy.analyticsSummary(days));
  }

  return { analyticsRoutes, analyticsAdminRoutes };
}
