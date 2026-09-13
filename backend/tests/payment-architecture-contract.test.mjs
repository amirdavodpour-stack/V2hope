import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const routes = fs.readFileSync(new URL('../src/routes/payment_routes.js', import.meta.url), 'utf8');
const webhook = fs.readFileSync(new URL('../src/application/payment_webhook.js', import.meta.url), 'utf8');
const policy = fs.readFileSync(new URL('../src/application/payment_policy.js', import.meta.url), 'utf8');

test('payment route delegates policy and webhook mechanics to application modules', () => {
  assert.match(routes, /application\/payment_policy\.js/);
  assert.match(routes, /application\/payment_webhook\.js/);
  assert.doesNotMatch(routes, /createHmac\(/);
  assert.doesNotMatch(routes, /timingSafeEqual\(/);
  assert.match(webhook, /createHmac\(/);
  assert.match(webhook, /timingSafeEqual\(/);
  assert.match(policy, /validateIdempotencyPair/);
});

test('payment route remains an HTTP adapter rather than a business-rule container', () => {
  const lines = routes.split('\n').length;
  assert.ok(lines < 190, `payment route grew to ${lines} lines; keep orchestration in application modules`);
});
