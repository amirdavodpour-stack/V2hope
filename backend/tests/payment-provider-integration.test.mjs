import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-provider-'));
const key = path.join(tmp, 'key.pem');
const cert = path.join(tmp, 'cert.pem');
execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'], { stdio:'ignore' });

const requests = [];
const tlsServer = https.createServer({ key:fs.readFileSync(key), cert:fs.readFileSync(cert) }, (req,res) => {
  let body='';
  req.on('data', c => body += c);
  req.on('end', () => {
    requests.push({ path:req.url, headers:req.headers, body:JSON.parse(body || '{}') });
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify(req.url.includes('/refund') ? { status:'REFUNDED', refundRef:'REF-1' }
      : req.url.includes('/release') ? { status:'RELEASED', releaseRef:'REL-1' }
      : { status:'HELD', providerRef:'HOLD-1' }));
  });
});
await new Promise(resolve => tlsServer.listen(0,'127.0.0.1',resolve));
const port = tlsServer.address().port;

process.env.NODE_ENV='test';
process.env.PAYMENT_PROVIDER='webhook';
process.env.PAYMENT_PROVIDER_TOKEN='provider-test-token-0123456789';
process.env.PAYMENT_PROVIDER_CREATE_URL=`https://127.0.0.1:${port}/create`;
process.env.PAYMENT_PROVIDER_RELEASE_URL=`https://127.0.0.1:${port}/release`;
process.env.PAYMENT_PROVIDER_REFUND_URL=`https://127.0.0.1:${port}/refund`;
process.env.PAYMENT_PROVIDER_MAX_ATTEMPTS='3';
process.env.PAYMENT_PROVIDER_RETRY_BASE_MS='0';
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';

const { createPaymentProvider } = await import('../src/payment_provider.js');
const { config } = await import('../src/config.js');
const provider = createPaymentProvider('webhook');

after(async () => {
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  await new Promise(resolve => tlsServer.close(resolve));
  fs.rmSync(tmp,{recursive:true,force:true});
});

test('webhook payment provider performs authenticated HTTPS operations with idempotency keys', async () => {
  const created = await provider.createHold({ paymentId:'p1', amount:120, currency:'USD', idempotencyKey:'idem-create' });
  assert.equal(created.status,'HELD');
  assert.equal(created.providerRef,'HOLD-1');

  const released = await provider.releaseHold({ paymentId:'p1', providerRef:'HOLD-1', idempotencyKey:'idem-release' });
  assert.equal(released.status,'RELEASED');

  const refunded = await provider.refundHold({ paymentId:'p1', providerRef:'HOLD-1', idempotencyKey:'idem-refund' });
  assert.equal(refunded.status,'REFUNDED');
  assert.equal(refunded.refundRef,'REF-1');

  assert.equal(requests.length,3);
  for (const item of requests) {
    assert.equal(item.headers.authorization,'Bearer provider-test-token-0123456789');
    assert.match(item.headers['idempotency-key'],/^idem-/);
  }
  assert.equal(requests[0].body.operation,'createHold');
  assert.equal(requests[1].body.operation,'releaseHold');
  assert.equal(requests[2].body.operation,'refundHold');
});


test('webhook payment provider retries transient upstream failures with the same idempotency key', async () => {
  let attempts = 0;
  const retryServer = https.createServer({ key:fs.readFileSync(key), cert:fs.readFileSync(cert) }, (req,res) => {
    attempts += 1;
    res.setHeader('content-type','application/json');
    if (attempts === 1) { res.statusCode = 503; res.end(JSON.stringify({ error:'temporary' })); return; }
    res.end(JSON.stringify({ status:'HELD', providerRef:'HOLD-RETRY' }));
  });
  await new Promise(resolve => retryServer.listen(0,'127.0.0.1',resolve));
  const retryPort = retryServer.address().port;
  const { createPaymentProvider: createProvider } = await import('../src/payment_provider.js');
  const retryProvider = createProvider('webhook');
  // Temporarily route the global provider config to the retry endpoint.
  const original = config.paymentProviderCreateUrl;
  config.paymentProviderCreateUrl = `https://127.0.0.1:${retryPort}/create`;
  try {
    const result = await retryProvider.createHold({ paymentId:'p-retry', amount:50, idempotencyKey:'idem-retry' });
    assert.equal(result.providerRef,'HOLD-RETRY');
    assert.equal(attempts,2);
  } finally {
    config.paymentProviderCreateUrl = original;
    await new Promise(resolve => retryServer.close(resolve));
  }
});


test('provider adapter rejects malformed success payloads', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({status:'HELD'}), {status:200, headers:{'content-type':'application/json'}});
  process.env.PAYMENT_PROVIDER_CREATE_URL = 'https://provider.invalid/create';
  const {createPaymentProvider} = await import('../src/payment_provider.js');
  const provider = createPaymentProvider('webhook');
  try {
    await assert.rejects(provider.createHold({paymentId:'malformed-1',amount:10,idempotencyKey:'malformed-1'}), /INVALID_CREATE_RESPONSE/);
  } finally {
    global.fetch = original;
  }
});
