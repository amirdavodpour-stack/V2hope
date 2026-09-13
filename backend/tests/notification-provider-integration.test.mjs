import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-notify-provider-'));
const key = path.join(tmp, 'key.pem');
const cert = path.join(tmp, 'cert.pem');
execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'], { stdio:'ignore' });

let attempts = 0;
const requests = [];
const server = https.createServer({ key:fs.readFileSync(key), cert:fs.readFileSync(cert) }, (req,res) => {
  let body='';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    attempts += 1;
    requests.push({ headers:req.headers, body:JSON.parse(body || '{}') });
    res.setHeader('content-type','application/json');
    if (attempts === 1) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error:'temporary' }));
      return;
    }
    res.end(JSON.stringify({ delivered:true }));
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

process.env.NODE_ENV = 'test';
process.env.NOTIFICATION_PROVIDER_TOKEN = 'notification-test-token-0123456789';
process.env.NOTIFICATION_MAX_ATTEMPTS = '3';
process.env.NOTIFICATION_RETRY_BASE_MS = '0';
process.env.NOTIFICATION_DELIVERY_TIMEOUT_MS = '2000';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { config } = await import('../src/config.js');
const { deliverNotification } = await import('../src/notification_provider.js');

// eslint-disable-next-line no-undef
void config;

after(async () => {
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmp, { recursive:true, force:true });
});

test('notification provider retries transient failures with stable idempotency key', async () => {
  const result = await deliverNotification({
    url:`https://127.0.0.1:${port}/push`,
    payload:{ notificationId:'n1', userId:'u1', token:'device-1', title:'Hello', body:'World' },
    idempotencyKey:'notification:n1:PUSH:device-1',
  });
  assert.equal(result.status, 200);
  assert.equal(result.attempts, 2);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.authorization, 'Bearer notification-test-token-0123456789');
  assert.equal(requests[0].headers['idempotency-key'], 'notification:n1:PUSH:device-1');
  assert.equal(requests[1].headers['idempotency-key'], 'notification:n1:PUSH:device-1');
});
