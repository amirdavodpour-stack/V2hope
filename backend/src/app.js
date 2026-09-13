import crypto from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';
import { config, HOPE_VERSION } from './config.js';
import { db, initDatabase, seedBaseData, databaseHealth, withTransaction } from './db.js';
import * as repo from './repository.js';
import { hashPassword, verifyPassword, passwordNeedsRehash, PASSWORD_MAX_LENGTH, randomToken, sha256, signAccessToken, DUMMY_PASSWORD_HASH } from './security.js';
import { HttpError, sendJson, sendError, sendRateLimited, setCors, readBody, readRawBody, readMultipartSingleFile } from './http.js';
import { CITY_COORDS, haversineKm, parseCoordinate } from './application/geo.js';
import { requestId, recordRequest, rateLimitAuth, rateLimitGeneral, rateLimitHealth, rateLimitAuthAccount, metricsSnapshot, logEvent } from './observability.js';
import { traceContext, makeTraceparent } from './tracing.js';
import { processPaymentCreateHoldNow, processPaymentReleaseNow, processPaymentRefundNow } from './outbox_worker.js';
import { calculatePaymentBreakdown, fundingJournal, releaseJournal, payoutJournal, refundJournal } from './financial.js';
import { notifyUser, NOTIFICATION_TYPES } from './notifications.js';
import { recordAnalyticsEvent, recordCrash, localProductFunnelSummary } from './analytics.js';
import { getProductFunnelSummary } from './repository.js';
import { buildCandidateProfile, scoreRecommendation } from './recommendation.js';
import { JOB_TYPES, JOB_KINDS, JOB_VISIBILITY, JOB_SCHEDULES, BUDGET_TYPES, requireFields, stringField, textField, moneyField, dateOnlyField, enumField, requireAdmin, readIdempotencyKey } from './policies/validation.js';
import { createSessionService } from './services/session.js';
import { sanitizeTelemetryProperties, anonymizedEmail, deletionCredential, buildDataExport } from './privacy.js';
import { storage } from './storage.js';
import { createAuthRoutes } from './routes/auth_routes.js';
import { createProviderRoutes } from './routes/provider_routes.js';
import { createPaymentRoutes } from './routes/payment_routes.js';
import { createNotificationRoutes } from './routes/notification_routes.js';
import { createNotificationLegacy } from './application/legacy/notification_legacy.js';
import { createSavedSearchLegacy } from './application/legacy/saved_search_legacy.js';
import { createAnalyticsLegacy } from './application/legacy/analytics_legacy.js';
import { createAnalyticsRoutes } from './routes/analytics_routes.js';
import { createStorageRoutes } from './routes/storage_routes.js';
import { createAdminRoutes } from './routes/admin_routes.js';
import { createAccountRoutes } from './routes/account_routes.js';
import { createJobRoutes } from './routes/job_routes.js';
import { createOfferRoutes } from './routes/offer_routes.js';
import { createApplicationRoutes } from './routes/application_routes.js';
import { createSavedSearchRoutes } from './routes/saved_search_routes.js';
import { createAppViewHelpers } from './application/view_helpers.js';
import { createPaymentUseCases, createJobUseCases, createApplicationUseCases, createAdminUseCases } from './application/use_cases/index.js';
import { createRequestContext } from './api/request_context.js';
import { createRepositoryPorts } from './application/ports/repository_ports.js';
import { createAdminLegacyAdapter } from './application/legacy/admin_legacy.js';
import { createJobLegacyAdapter } from './application/legacy/job_legacy.js';
import { createAccountLegacyAdapter } from './application/legacy/account_legacy.js';
import { createPaymentLegacyAdapter } from './application/legacy/payment_legacy.js';
import { createAuthLegacyAdapter } from './application/legacy/auth_legacy.js';
import { createApplicationLegacyAdapter } from './application/legacy/application_legacy.js';
import { createSessionLegacyAdapter } from './application/legacy/session_legacy.js';
import { createOfferLegacyAdapter } from './application/legacy/offer_legacy.js';
import { createStorageLegacyAdapter } from './application/legacy/storage_legacy.js';
import { createAppLegacyAdapter } from './application/legacy/app_legacy.js';

await initDatabase();
await seedBaseData();

const now = () => new Date().toISOString();

// Load category metadata once at composition time. In PostgreSQL runtime this
// keeps view helpers independent from db.collection while preserving the
// in-memory category behavior used by the explicit legacy test runtime.
const appLegacy = createAppLegacyAdapter({ db });
const viewCategories = process.env.DATABASE_URL ? await repo.listCategories() : appLegacy.categories();

const sessionLegacy = createSessionLegacyAdapter({ db });
const sessionService = createSessionService({ config, repo, logEvent, now, legacy: sessionLegacy });
const { getUserById, getUserByEmail, authUser, issueSession, deliverPasswordReset } = sessionService;

const notificationLegacy = createNotificationLegacy({ db, now });
const notificationRoutes = createNotificationRoutes({
  authUser,
  repo,
  legacy: notificationLegacy,
  readBody,
  sendJson,
  HttpError,
  requireFields,
  enumField,
  textField,
  now,
});
const analyticsLegacy = createAnalyticsLegacy({ db });
const { analyticsRoutes, analyticsAdminRoutes } = createAnalyticsRoutes({
  authUser, requireAdmin, readBody, sendJson, HttpError, sanitizeTelemetryProperties,
  recordAnalyticsEvent, recordCrash, logEvent, repo, getProductFunnelSummary,
  localProductFunnelSummary, legacy: analyticsLegacy,
});

async function notifyApplicationCandidate(applicationId, type, title, body) {
  const application = process.env.DATABASE_URL ? await repo.getJobApplicationById(applicationId) : appLegacy.findApplicationById(applicationId);
  if (!application) return;
  await getJob(application.jobId);
  await notifyUser({userId:application.candidateId,type,title,body,data:{jobId:application.jobId,applicationId},dedupeKey:`application:${applicationId}:${type}`,channels:['IN_APP','PUSH','EMAIL']});
}

const findUser = (id) => process.env.DATABASE_URL ? undefined : appLegacy.findUserById(id);
async function getJob(id) { return process.env.DATABASE_URL ? repo.findJobById(id) : appLegacy.findJobById(id); }

// Compose all application use-cases before any route factory can capture them.
// This prevents temporal-dead-zone wiring and keeps route construction deterministic.
const repositoryPorts = createRepositoryPorts(repo);
const paymentUseCases = createPaymentUseCases({ payments: repositoryPorts.payments });
const jobUseCases = createJobUseCases({ jobs: repositoryPorts.jobs });
const applicationUseCases = createApplicationUseCases({ applications: repositoryPorts.applications });
const adminUseCases = createAdminUseCases({ admin: repositoryPorts.admin });
const adminLegacy = createAdminLegacyAdapter({ db, findUser, now });
const accountLegacy = createAccountLegacyAdapter({ db, findUser, now });
const paymentLegacy = createPaymentLegacyAdapter({ db, withTransaction, fundingJournal, refundJournal, releaseJournal, payoutJournal, now });
const authLegacy = createAuthLegacyAdapter({ db, findUser, issueSession, withTransaction, now });
const applicationLegacy = createApplicationLegacyAdapter({ db, id: db.id, now });
const offerLegacy = createOfferLegacyAdapter({ db, id: db.id, now, withTransaction });
const storageLegacy = createStorageLegacyAdapter({ db, id: db.id, now });

const storageRoutes = createStorageRoutes({
  authUser, storage, config, readBody, readMultipartSingleFile, requireFields, stringField,
  sendJson, HttpError, repo, legacy: storageLegacy, id: db.id, now, logEvent,
});


const adminRoutes = createAdminRoutes({
  authUser, requireAdmin, readBody, sendJson, HttpError, enumField, repo, adminUseCases, legacyAdmin: adminLegacy, config, now, paymentUseCases,
  createAudit: (...args) => createAudit(...args), findUser, getJob: (...args) => getJob(...args),
  notifyApplicationCandidate: (...args) => notifyApplicationCandidate(...args), URL,
});

const accountRoutes = createAccountRoutes({
  authUser, readBody, sendJson, HttpError, hashPassword, privacyRepo: repositoryPorts.privacy, legacyAccount: accountLegacy, storage, anonymizedEmail, deletionCredential, buildDataExport, logEvent,
});


const {
  getProvider, categoryBy, publicUser, authUserView, categoryView, buildOfferCountMap,
  offerCountFor, jobView, paymentView, relatedJob, enforceJobState, createAudit,
} = createAppViewHelpers({ repo, config, getUserById, now, HttpError, env: process.env, categories: viewCategories, id: appLegacy.id, legacy: { providers: appLegacy.findProvidersForView(), offers: appLegacy.findOffersForView(), insertAudit: appLegacy.insertAudit } });
const jobLegacy = createJobLegacyAdapter({ db, categoryBy, relatedJob, findUser, publicUser, now });

const authRoutes = createAuthRoutes({
  authUser, authUserView, getUserByEmail, issueSession, deliverPasswordReset, findUser, rateLimitAuthAccount,
  readBody, sendJson, HttpError, requireFields, repo, config, now, hashPassword,
  verifyPassword, passwordNeedsRehash, PASSWORD_MAX_LENGTH, randomToken, sha256, signAccessToken, createAudit, DUMMY_PASSWORD_HASH, logEvent, stringField,
  id: db.id, legacy: authLegacy,
});
const providerRoutes = createProviderRoutes({ authUser, getProvider, publicUser, repo, sendJson, HttpError, now, id: appLegacy.id, insertProvider: appLegacy.insertProvider, legacy: { jobs: appLegacy.jobs() } });
const paymentRoutes = createPaymentRoutes({
  authUser, readBody, readRawBody, sendJson, HttpError, config, repo, getJob, enforceJobState, paymentUseCases,
  readIdempotencyKey, requireFields, enumField, paymentView, relatedJob, withTransaction, createAudit, calculatePaymentBreakdown,
  fundingJournal, releaseJournal, payoutJournal, refundJournal, paymentLegacy, processPaymentCreateHoldNow,
  processPaymentReleaseNow, processPaymentRefundNow, notifyUser, NOTIFICATION_TYPES, logEvent, now,
});

const jobRoutes = createJobRoutes({ getJob, authUser, id: db.id, repo, legacyJobs: jobLegacy, jobUseCases, readBody, sendJson, HttpError, requireFields, textField, moneyField, enumField, JOB_TYPES, JOB_KINDS, JOB_VISIBILITY, JOB_SCHEDULES, BUDGET_TYPES, dateOnlyField, categoryBy, jobView, paymentView, buildOfferCountMap, relatedJob, enforceJobState, createAudit, now, findUser, publicUser, notifyApplicationCandidate, NOTIFICATION_TYPES });
const offerRoutes = createOfferRoutes({ authUser, readBody, sendJson, HttpError, requireFields, textField, moneyField, repo, legacy: offerLegacy, id: db.id, getJob, enforceJobState, createAudit, now, jobView });
const savedSearchLegacy = createSavedSearchLegacy({ db, textField, now });
const savedSearchRoutes = createSavedSearchRoutes({ authUser, repo, legacy: savedSearchLegacy, readBody, sendJson, HttpError, textField });
const applicationRoutes = createApplicationRoutes({ authUser, readBody, sendJson, HttpError, requireFields, textField, repo, applicationUseCases, legacy: applicationLegacy, id: db.id, getJob, createAudit, now, notifyUser, NOTIFICATION_TYPES });

export async function handle(req, res) {
  const startedAt = process.hrtime.bigint();
  const rid = requestId(req);
  const trace = traceContext(req);
  Object.defineProperty(req, 'context', {
    value: createRequestContext({
      requestId: rid,
      traceId: trace.traceId,
      method: req.method,
      path: new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname,
    }),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  res.setHeader('X-Request-Id', rid);
  res.setHeader('traceparent', makeTraceparent(trace));
  // Staging-only instance identity lets the local integration gate prove that
  // the gateway actually reaches both replicas without exposing topology in
  // normal production deployments.
  if (process.env.STAGING_INSTANCE_ID) res.setHeader('X-Instance-ID', process.env.STAGING_INSTANCE_ID);
  setCors(res, req);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const originalEnd = res.end.bind(res);
  let recorded = false;
  const finishRecord = (statusCode) => {
    if (recorded) return;
    recorded = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    recordRequest(statusCode, durationMs, `${req.method} ${url.pathname}`);
  };
  res.end = ((chunk, encoding, callback) => {
    finishRecord(res.statusCode || 200);
    return originalEnd(chunk, encoding, callback);
  });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/metrics') {
    if (config.metricsToken) {
      const provided = String(req.headers['x-metrics-token'] || '');
      const expected = config.metricsToken;
      const providedBuf = Buffer.from(provided);
      const expectedBuf = Buffer.from(expected);
      const tokenOk = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);
      if (!tokenOk) {
        const metricsError = new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
        return sendError(res, metricsError);
      }
    }
    const body = JSON.stringify(metricsSnapshot());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(body);
  }
  if (url.pathname.startsWith('/api/v1/auth/') && !(await rateLimitAuth(req, config.authRateLimitMax, config.rateLimitWindowMs))) {
    return sendRateLimited(res, 'RATE_LIMITED', 'Too many authentication requests', Math.ceil(config.rateLimitWindowMs / 1000));
  }
  const isLive = url.pathname === '/live' || url.pathname === '/api/v1/live';
  const isHealth = url.pathname === '/health' || url.pathname === '/api/v1/health' || url.pathname === '/ready' || url.pathname === '/api/v1/ready';
  if (isHealth && !(await rateLimitHealth(req, config.healthRateLimitMax, config.healthRateLimitWindowMs))) {
    return sendRateLimited(res, 'RATE_LIMITED', 'Too many health probes', Math.ceil(config.healthRateLimitWindowMs / 1000));
  }
  if (!isLive && !isHealth && !url.pathname.startsWith('/metrics') && !(await rateLimitGeneral(req, config.generalRateLimitMax, config.generalRateLimitWindowMs))) {
    return sendRateLimited(res, 'RATE_LIMITED', 'Too many requests', Math.ceil(config.generalRateLimitWindowMs / 1000));
  }
  const parts = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
  try {
    if (url.pathname === '/live' || url.pathname === '/api/v1/live') {
      return sendJson(res, 200, { alive: true, service: 'hope-api', version: process.env.HOPE_VERSION || HOPE_VERSION, time: now() });
    }
    if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
      const database = await databaseHealth();
      const healthy = database.status === 'ok';
      return sendJson(res, healthy ? 200 : 503, { status: healthy ? 'ok' : 'degraded', service: 'hope-api', version: process.env.HOPE_VERSION || HOPE_VERSION, database, time: now() });
    }
    if (url.pathname === '/ready' || url.pathname === '/api/v1/ready') {
      const database = await databaseHealth();
      const ready = database.status === 'ok';
      return sendJson(res, ready ? 200 : 503, { ready, service: 'hope-api', database, time: now() });
    }
    if (parts[0] === 'auth') return await authRoutes(req, res, parts);
    if (parts[0] === 'account') return await accountRoutes(req, res, parts.slice(1));
    if (parts[0] === 'providers') return await providerRoutes(req, res, parts);
    if (parts[0] === 'jobs' && parts[1] === 'recommended') return await recommendedJobs(req, res);
    if (parts[0] === 'jobs') return await jobRoutes(req, res, parts);
    if (parts[0] === 'offers') return await offerRoutes(req, res, parts);
    if (parts[0] === 'applications') return await applicationRoutes(req, res, parts);
    if (parts[0] === 'saved-searches') return await savedSearchRoutes(req, res, parts);
    if (parts[0] === 'admin') return await adminRoutes(req, res, parts);
    if (parts[0] === 'payments') return await paymentRoutes(req, res, parts);
    if (parts[0] === 'storage') return await storageRoutes(req, res, parts);
    if (parts[0] === 'verticals') return await verticalRoutes(req, res, parts);
    if (parts[0] === 'categories') return await categoryRoutes(req, res, parts);
    if (parts[0] === 'analytics' && parts[1] === 'admin') return await analyticsAdminRoutes(req,res,parts.slice(2));
    if (parts[0] === 'analytics') return await analyticsRoutes(req,res,parts.slice(1));
    if (parts[0] === 'notifications') return await notificationRoutes(req, res, parts);
    throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  } catch (error) {
    const status = error?.status || 500;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logEvent({ level: status >= 500 ? 'error' : 'warn', requestId: rid, traceId: trace.traceId, method: req.method, path: url.pathname, status, durationMs: Number(durationMs.toFixed(2)), code: error?.code || 'INTERNAL_ERROR', message: error?.message || 'Internal server error' });
    sendError(res, error);
  } finally {
    try { await db.flush(); } catch (persistError) { console.error('[db] persistence flush failed:', persistError); }
  }
}

// The in-memory fallback has no verticals table; the whole
// legacy dataset belongs to the seeded 'jobs' vertical.
const DEFAULT_VERTICAL_SLUG = 'jobs';
const FALLBACK_VERTICALS = [{ id: DEFAULT_VERTICAL_SLUG, slug: DEFAULT_VERTICAL_SLUG, name: 'Jobs', nameEn: 'Jobs', description: 'Default HOPE jobs vertical (missions and positions).', config: {}, isActive: true, sortOrder: 0 }];

function verticalParam(req) {
  const raw = new URL(req.url, 'http://localhost').searchParams.get('vertical');
  if (raw === null) return null;
  const slug = raw.trim();
  if (!slug) return null;
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) throw new HttpError(400, 'INVALID_VERTICAL', 'vertical must be a slug');
  return slug;
}

async function verticalRoutes(req, res, parts) {
  if (parts.length !== 1) throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  if (req.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  const toView = (v) => ({ id:v.id, slug:v.slug, name:v.name, nameEn:v.nameEn||'', description:v.description||'', config:v.config||{}, isActive:v.isActive!==false, sortOrder:Number(v.sortOrder||0) });
  if (process.env.DATABASE_URL) return sendJson(res, 200, (await repo.listVerticals()).map(toView));
  return sendJson(res, 200, FALLBACK_VERTICALS.map(toView));
}

async function categoryRoutes(req, res) {
  if (req.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  const vertical = verticalParam(req);
  const toView = (c) => ({ id:c.id, slug:c.slug, name:c.name, nameEn:c.nameEn||'', description:c.description||'', parentId:c.parentId||null, sortOrder:Number(c.sortOrder||0), isActive:c.isActive!==false });
  if (process.env.DATABASE_URL) return sendJson(res, 200, (await repo.listCategories(vertical)).map(toView));
  if (vertical && vertical !== DEFAULT_VERTICAL_SLUG) return sendJson(res, 200, []);
  return sendJson(res, 200, appLegacy.categories().filter((c)=>c.isActive!==false).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(toView));
}

function recommendationScore(job, context) {
  const profile = context.profile || buildCandidateProfile([]);
  return scoreRecommendation(job, profile, { ...context, cityCoords: CITY_COORDS, distanceFn: haversineKm });
}

async function recommendedJobs(req, res) {
  const user = req.headers.authorization ? await authUser(req) : null;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const requestedCity = url.searchParams.get('city') ? textField(url.searchParams.get('city'), 'city', {min:1,max:120}) : null;
  const city = requestedCity || null;
  const kind = url.searchParams.get('kind') ? enumField(url.searchParams.get('kind'), JOB_KINDS, 'kind') : null;
  const categoryId = url.searchParams.get('categoryId') ? String(url.searchParams.get('categoryId')).trim() : null;
  const hasLat = url.searchParams.has('lat'), hasLng = url.searchParams.has('lng');
  if (hasLat !== hasLng) throw new HttpError(400, 'INVALID_COORDINATE', 'lat and lng must be provided together');
  let lat = null, lng = null;
  if (hasLat) {
    lat = parseCoordinate(url.searchParams.get('lat'), 'lat');
    lng = parseCoordinate(url.searchParams.get('lng'), 'lng');
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new HttpError(400, 'INVALID_COORDINATE', 'coordinates are out of range');
  }
  let applications = [];
  if (user) applications = process.env.DATABASE_URL ? await repo.listCandidateApplications(user.id) : appLegacy.findApplicationsByCandidate(user.id).map(a => { const j=appLegacy.findJobById(a.jobId); return {...a,jobCity:j?.city||null,jobKind:j?.kind||'JOB',categoryId:j?.categoryId||null,monthlySalary:j?.monthlySalary||null}; });
  const profile = buildCandidateProfile(applications);
  const rows = process.env.DATABASE_URL
    ? await repo.listJobViews({status:'PUBLISHED', kind, categoryId, city:null, visibility:null, search:null})
    : appLegacy.jobs().filter(j => j.status === 'PUBLISHED' && (!kind || (j.kind || (j.jobType==='FIXED'?'MISSION':'JOB')) === kind) && (!categoryId || String(j.categoryId) === categoryId || categoryBy(categoryId)?.id === j.categoryId)).map(job => ({job,category:categoryBy(job.categoryId)?.name,owner:null,provider:null,offerCount:0}));
  const scored = [];
  const seenCategories = new Set();
  for (const {job,category,owner,provider,offerCount} of rows) {
    const view = await jobView(job, user?.id, new Map([[job.id, offerCount]]), {owner,provider,category});
    const match = recommendationScore(view, {lat,lng,city,kind,categoryId,profile,seenCategories});
    scored.push({...view, recommendationScore:match.score, distanceKm:match.distanceKm, recommendationReasons:match.reasons, recommendationComponents:match.componentScores});
  }
  scored.sort((a,b) => (b.recommendationScore-a.recommendationScore) || String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  if (user) await recordAnalyticsEvent({eventName:'recommendation_served',platform:'UNKNOWN',properties:{count:Math.min(50,scored.length), personalized:applications.length>0}}, user.id, `recommendation_served:${user.id}:${new Date().toISOString().slice(0,13)}`).catch(()=>{});
  return sendJson(res, 200, scored.slice(0, 50));
}

export function createServer() { return http.createServer(handle); }
