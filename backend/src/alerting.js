import { config } from './config.js';

let lastFingerprint = '';
let lastSentAt = 0;
const COOLDOWN_MS = 5 * 60 * 1000;

function fingerprint(alerts) {
  return alerts.map((a) => `${a.code}:${a.severity}`).sort().join('|');
}

export async function dispatchOperationalAlerts(snapshot) {
  if (!config.alertWebhookUrl) return { dispatched: false, reason: 'disabled' };
  const alerts = Array.isArray(snapshot?.health?.alerts) ? snapshot.health.alerts.filter(Boolean) : [];
  if (!alerts.length) { lastFingerprint = ''; return { dispatched: false, reason: 'no-alerts' }; }
  const fp = fingerprint(alerts);
  const now = Date.now();
  if (fp === lastFingerprint && now - lastSentAt < COOLDOWN_MS) return { dispatched: false, reason: 'cooldown' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.alertWebhookTimeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(config.alertWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.alertWebhookToken}` },
      body: JSON.stringify({ service: 'hope-api', version: process.env.HOPE_VERSION || '4.0.2', occurredAt: new Date().toISOString(), alerts, recentHealth: snapshot.recentHealth, latency: snapshot.latency }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`alert webhook returned ${response.status}`);
    lastFingerprint = fp;
    lastSentAt = now;
    return { dispatched: true };
  } catch (error) {
    return { dispatched: false, reason: 'delivery-failed', error: error.message };
  } finally { clearTimeout(timer); }
}
