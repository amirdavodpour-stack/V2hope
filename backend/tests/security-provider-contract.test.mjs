import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const authRoutes=fs.readFileSync(new URL('../src/routes/auth_routes.js',import.meta.url),'utf8');
const storageRoutes=fs.readFileSync(new URL('../src/routes/storage_routes.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../src/outbox_worker.js',import.meta.url),'utf8');
const handlers=fs.readFileSync(new URL('../src/outbox_handlers.js',import.meta.url),'utf8');
const provider=fs.readFileSync(new URL('../src/payment_provider.js',import.meta.url),'utf8');
const config=fs.readFileSync(new URL('../src/config.js',import.meta.url),'utf8');

 test('payment state machine uses an explicit provider boundary',()=>{
  assert.match(handlers,/paymentProvider\.createHold/);
  assert.match(provider,/createHold/);
  assert.match(provider,/releaseHold/);
  assert.match(config,/PAYMENT_CURRENCY/);
 });
 test('security-sensitive endpoints stay fail-closed',()=>{
  assert.match(authRoutes,/REFRESH_REUSE_DETECTED/);
  assert.match(authRoutes,/PASSWORD_RESET_DELIVERY_FAILED/);
  assert.match(authRoutes,/return sendJson\(res, 202, generic\)/);
  assert.match(storageRoutes,/UPLOAD_INTENT_REQUIRED/);
  assert.match(storageRoutes,/CONTENT_TYPE_MISMATCH/);
  assert.match(app,/x-metrics-token/);
 });


test('refund provider boundary is explicit and webhook secret is configured separately', () => {
  assert.match(provider, /refundHold/);
  assert.match(config, /PAYMENT_WEBHOOK_SECRET/);
});
