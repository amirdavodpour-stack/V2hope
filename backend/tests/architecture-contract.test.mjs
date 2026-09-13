import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('backend composition root delegates validation and session policy to dedicated modules', () => {
  const app = read('backend/src/app.js');
  const validation = read('backend/src/policies/validation.js');
  const session = read('backend/src/services/session.js');
  assert.match(app, /\.\/policies\/validation\.js/);
  assert.match(app, /\.\/services\/session\.js/);
  assert.match(validation, /export function readIdempotencyKey/);
  assert.match(session, /createSessionService/);
  assert.doesNotMatch(app, /function verifyAccessToken\(/);
  assert.doesNotMatch(app, /function signAccessToken\(/);
});

test('view helpers do not read categories directly from the persistence facade', () => {
  const helper = read('backend/src/application/view_helpers.js');
  assert.doesNotMatch(helper, /db\.collection\.categories/);
  assert.match(helper, /categories\.find/);
});

test('repository row mapping is isolated from SQL orchestration', () => {
  const repo = read('backend/src/repository/core.js');
  const mappers = read('backend/src/repository/mappers.js');
  assert.match(repo, /from ['"]\.\/mappers\.js['"]/);
  for (const marker of ['userFromRow','jobFromRow','offerFromRow','paymentFromRow','applicationFromRow','employerCandidateFromRow']) {
    assert.match(mappers, new RegExp(`export const ${marker}`));
    assert.doesNotMatch(repo, new RegExp(`function ${marker}\\b`));
  }
});


test('notification routing is extracted from the composition root', () => {
  const app = read('backend/src/app.js');
  const routes = read('backend/src/routes/notification_routes.js');
  assert.match(app, /createNotificationRoutes/);
  assert.match(app, /parts\[0\] === 'notifications'/);
  assert.match(routes, /export function createNotificationRoutes/);
  assert.match(routes, /read-all/);
  assert.match(routes, /registerNotificationDevice/);
  assert.doesNotMatch(app, /async function notificationRoutes\(/);
});



test('jobs, offers and applications routing is extracted from the composition root', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  for (const routeFile of ['job_routes.js','offer_routes.js','application_routes.js']) {
    const source = fs.readFileSync(new URL(`../src/routes/${routeFile}`, import.meta.url), 'utf8');
    assert.match(source, /export function create/);
  }
  assert.doesNotMatch(app, /async function jobRoutes\(/);
  assert.doesNotMatch(app, /async function offerRoutes\(/);
  assert.doesNotMatch(app, /async function applicationRoutes\(/);
});

test('outbox orchestration is separated from delivery handlers', () => {
  const worker = read('backend/src/outbox_worker.js');
  const handlers = read('backend/src/outbox_handlers.js');
  assert.match(worker, /processOutboxEvent/);
  assert.match(handlers, /export async function processOutboxEvent/);
  assert.doesNotMatch(worker, /PAYMENT_CREATE_HOLD/);
  assert.doesNotMatch(worker, /NOTIFICATION_DISPATCH/);
  assert.ok(worker.split('\n').length < 70, 'worker should remain an orchestration shell');
});


test('transport-neutral errors keep application and policy layers independent of HTTP', () => {
  const errorModule = read('backend/src/api/http_error.js');
  assert.match(errorModule, /export class HttpError extends Error/);
  for (const module of [
    'backend/src/application/geo.js',
    'backend/src/application/payment_policy.js',
    'backend/src/policies/validation.js',
    'backend/src/policies/attributes.js',
    'backend/src/services/session.js',
  ]) {
    assert.doesNotMatch(read(module), /from ['"]\.\.?\/.*http\.js['"]/,
      `${module} must not depend on the HTTP transport module`);
  }
  assert.match(read('backend/src/http.js'), /from ['"]\.\/api\/http_error\.js['"]/);
});
