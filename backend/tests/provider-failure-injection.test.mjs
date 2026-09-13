import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-failure-injection-'));
const key = path.join(tmp, 'key.pem');
const cert = path.join(tmp, 'cert.pem');
execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'], { stdio:'ignore' });
process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER = 'webhook';
process.env.PAYMENT_PROVIDER_TOKEN = 'failure-test-token-0123456789';
process.env.PAYMENT_PROVIDER_MAX_ATTEMPTS = '3';
process.env.PAYMENT_PROVIDER_RETRY_BASE_MS = '0';
process.env.PAYMENT_PROVIDER_TIMEOUT_MS = '500';
process.env.NOTIFICATION_PROVIDER_TOKEN = 'failure-notification-token-0123456789';
process.env.NOTIFICATION_MAX_ATTEMPTS = '3';
process.env.NOTIFICATION_RETRY_BASE_MS = '0';
process.env.NOTIFICATION_DELIVERY_TIMEOUT_MS = '500';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let paymentRequests = 0;
let notificationRequests = 0;
const server = https.createServer({ key:fs.readFileSync(key), cert:fs.readFileSync(cert) }, (req, res) => {
  if (req.url?.startsWith('/payment')) {
    paymentRequests += 1;
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error:'upstream unavailable' }));
    return;
  }
  notificationRequests += 1;
  res.statusCode = 400;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error:'permanent rejection' }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
process.env.PAYMENT_PROVIDER_CREATE_URL = `https://127.0.0.1:${port}/payment/create`;
process.env.PAYMENT_PROVIDER_RELEASE_URL = `https://127.0.0.1:${port}/payment/release`;
process.env.PAYMENT_PROVIDER_REFUND_URL = `https://127.0.0.1:${port}/payment/refund`;

const { createPaymentProvider } = await import('../src/payment_provider.js');
const { deliverNotification } = await import('../src/notification_provider.js');
const paymentProvider = createPaymentProvider('webhook');

after(async () => {
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmp, { recursive:true, force:true });
});

test('payment provider exhausts only retryable upstream failures', async () => {
  await assert.rejects(
    paymentProvider.createHold({ paymentId:'fail-1', amount:100, idempotencyKey:'payment-fail-1' }),
    /PAYMENT_PROVIDER_HTTP_503/
  );
  assert.equal(paymentRequests, 3);
});

test('notification provider does not retry permanent 4xx failures', async () => {
  await assert.rejects(
    deliverNotification({
      url:`https://127.0.0.1:${port}/notification`,
      payload:{ notificationId:'n-permanent', userId:'u1' },
      idempotencyKey:'notification:n-permanent',
    }),
    /NOTIFICATION_PROVIDER_HTTP_400/
  );
  assert.equal(notificationRequests, 1);
});
