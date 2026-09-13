import { businessHealth } from './business_metrics.js';
import crypto from 'node:crypto';
import { config } from './config.js';
import { getPool } from './db.js';
import { createRateLimiter } from './rate_limit.js';
const LATENCY_SAMPLE_CAP = 2000;
const RECENT_WINDOW_MS = 5 * 60 * 1000;
const RECENT_SAMPLE_CAP = 5000;
const ROUTE_STATS_CAP = 1000;
const ROUTE_OTHER_KEY = '__other__';
const metrics = { requests: 0, errors4xx: 0, errors5xx: 0, authRateLimited: 0, requestDurationMsTotal: 0, requestDurationMsMax: 0, requestDurationBuckets: { lt50:0, lt100:0, lt250:0, lt500:0, gte500:0 }, routeStats: new Map(), outboxProcessed: 0, outboxFailed: 0, categoryFailures: { payment: 0, push: 0, email: 0, s3: 0 }, startedAt: Date.now() };
// Bounded reservoir of recent request durations, used only to compute
// approximate P50/P95/P99. Capped so memory stays flat under sustained load.
let latencySamples = [];
let recentRequests = [];
const rateLimiter = createRateLimiter({ pool: config.rateLimitStore === 'postgres' ? getPool() : null, trustProxy: config.trustProxy, trustedProxyIps: config.trustedProxyIps, onAuthLimited: () => { metrics.authRateLimited += 1; } });

export function requestId(req) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : crypto.randomUUID();
}
function normalizeRoute(method, route) {
  const raw = String(route || 'unknown');
  const separator = raw.indexOf(' ');
  const methodPart = separator > 0 ? raw.slice(0, separator) : String(method || '').toUpperCase();
  const path = separator > 0 ? raw.slice(separator + 1) : raw;
  const normalized = path
    .replace(/\/[0-9a-f-]{16,}(?=\/|$)/gi, '/:id')
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/\/+/g, '/');
  return `${methodPart || 'UNKNOWN'} ${normalized}`;
}

function pruneRecent(nowMs = Date.now()) {
  const cutoff = nowMs - RECENT_WINDOW_MS;
  while (recentRequests.length && recentRequests[0].at < cutoff) recentRequests.shift();
  if (recentRequests.length > RECENT_SAMPLE_CAP) recentRequests.splice(0, recentRequests.length - RECENT_SAMPLE_CAP);
}

function recentHealth() {
  pruneRecent();
  if (!recentRequests.length) return { requests: 0, errors5xx: 0, slow: 0, errorRate5xx: 0, slowRequestRate: 0 };
  const errors5xx = recentRequests.reduce((n, r) => n + (r.status >= 500 ? 1 : 0), 0);
  const slow = recentRequests.reduce((n, r) => n + (r.durationMs >= 500 ? 1 : 0), 0);
  const requests = recentRequests.length;
  return { requests, errors5xx, slow, errorRate5xx: errors5xx / requests, slowRequestRate: slow / requests };
}

export function recordRequest(status, durationMs = 0, route = 'unknown') {
  metrics.requests += 1;
  if (status >= 400 && status < 500) metrics.errors4xx += 1;
  if (status >= 500) metrics.errors5xx += 1;
  const duration = Math.max(0, Number(durationMs) || 0);
  recentRequests.push({ at: Date.now(), status, durationMs: duration });
  pruneRecent();
  metrics.requestDurationMsTotal += duration;
  metrics.requestDurationMsMax = Math.max(metrics.requestDurationMsMax, duration);
  if (duration < 50) metrics.requestDurationBuckets.lt50 += 1;
  else if (duration < 100) metrics.requestDurationBuckets.lt100 += 1;
  else if (duration < 250) metrics.requestDurationBuckets.lt250 += 1;
  else if (duration < 500) metrics.requestDurationBuckets.lt500 += 1;
  else metrics.requestDurationBuckets.gte500 += 1;
  let routeKey = normalizeRoute('', route);
  if (!metrics.routeStats.has(routeKey) && metrics.routeStats.size >= ROUTE_STATS_CAP) routeKey = ROUTE_OTHER_KEY;
  const current = metrics.routeStats.get(routeKey) || {requests:0,errors:0,totalMs:0,maxMs:0,slowRequests:0};
  current.requests += 1; current.errors += status >= 400 ? 1 : 0; current.totalMs += duration; current.maxMs = Math.max(current.maxMs, duration); if (duration >= 500) current.slowRequests += 1;
  metrics.routeStats.set(routeKey, current);
  latencySamples.push(duration);
  if (latencySamples.length > LATENCY_SAMPLE_CAP) latencySamples.splice(0, latencySamples.length - LATENCY_SAMPLE_CAP);
}
function percentile(sortedSamples, p) {
  if (!sortedSamples.length) return 0;
  const idx = Math.min(sortedSamples.length - 1, Math.ceil((p / 100) * sortedSamples.length) - 1);
  return sortedSamples[Math.max(0, idx)];
}
export function latencyPercentiles() {
  const sorted = [...latencySamples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) };
}
export function recordCategoryFailure(category) {
  if (Object.prototype.hasOwnProperty.call(metrics.categoryFailures, category)) metrics.categoryFailures[category] += 1;
}
export async function rateLimitAuth(req, limit, windowMs) { return rateLimiter.auth(req, limit, windowMs); }
export async function rateLimitGeneral(req, limit, windowMs) { return rateLimiter.general(req, limit, windowMs); }
export async function rateLimitHealth(req, limit, windowMs) { return rateLimiter.general(req, limit, windowMs); }
export async function rateLimitAuthAccount(identity, limit, windowMs) { return rateLimiter.account('auth', identity, limit, windowMs); }
export function recordOutboxProcessed() { metrics.outboxProcessed += 1; }
export function recordOutboxFailed() { metrics.outboxFailed += 1; }
export function metricsSnapshot() {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startedAt) / 1000);
  const routes = Object.fromEntries([...metrics.routeStats.entries()].sort((a,b)=>b[1].requests-a[1].requests).slice(0,100).map(([route,v])=>[route,{...v,avgMs:v.requests?Number((v.totalMs/v.requests).toFixed(2)):0}]));
  const {routeStats, ...scalar} = metrics;
  const memory = process.memoryUsage();
  return {
    ...scalar,
    uptimeSeconds,
    process: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, externalBytes: memory.external },
    routes,
    slowestRoutes: Object.fromEntries([...metrics.routeStats.entries()].sort((a,b) => (b[1].maxMs - a[1].maxMs) || (b[1].slowRequests - a[1].slowRequests)).slice(0,10).map(([route,v]) => [route, {maxMs:v.maxMs, slowRequests:v.slowRequests, avgMs:v.requests?Number((v.totalMs/v.requests).toFixed(2)):0}])),
    requestDurationMsAvg: metrics.requests ? Number((metrics.requestDurationMsTotal / metrics.requests).toFixed(2)) : 0,
    latency: latencyPercentiles(),
    health: businessHealth(metrics),
    recentHealth: (() => { const r = recentHealth(); return { ...r, windowSeconds: RECENT_WINDOW_MS / 1000 }; })(),
  };
}
export function logEvent(event) { process.stdout.write(JSON.stringify({ time: new Date().toISOString(), service: 'hope-api', ...event }) + '\n'); }
