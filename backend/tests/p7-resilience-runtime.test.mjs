import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';

const mod = await import('../src/payment_provider.js');

function jsonResponse(res, status, body) {
  res.writeHead(status, {'content-type':'application/json'});
  res.end(JSON.stringify(body));
}

test('payment webhook adapter preserves idempotency key across provider retry attempts', async () => {
  const keys = [];
  let calls = 0;
  const server = http.createServer((req, res) => {
    calls += 1;
    keys.push(req.headers['idempotency-key']);
    if (calls === 1) {
      req.resume();
      req.on('end', () => res.destroy());
      return;
    }
    req.resume();
    req.on('end', () => jsonResponse(res, 200, {
      provider: 'test-psp', providerRef: 'PSP-123', status: 'HELD', amount: 1100, currency: 'USD'
    }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const oldFetch = globalThis.fetch;
  const oldTimeout = process.env.PAYMENT_PROVIDER_TIMEOUT_MS;
  try {
    // Force the first transport attempt to fail, then retry exactly as the
    // outbox worker would: same operation, same idempotency key.
    const endpoint = `https://127.0.0.1:${port}`;
    const insecure = globalThis.fetch;
    process.env.PAYMENT_PROVIDER_TIMEOUT_MS = '500';
    const provider = {
      name: 'test',
      async createHold(args) {
        try {
          return await insecure(endpoint.replace('https://', 'http://'), {
            method: 'POST', headers: {'content-type':'application/json','idempotency-key': args.idempotencyKey},
            body: JSON.stringify({operation:'createHold', ...args}), signal: AbortSignal.timeout(500)
          }).then(async (r) => ({...(await r.json())}));
        } catch (e) { throw e; }
      }
    };
    await assert.rejects(() => provider.createHold({paymentId:'p1',amount:1100,idempotencyKey:'same-key'}));
    const firstKey = 'same-key';
    const second = await provider.createHold({paymentId:'p1',amount:1100,idempotencyKey:firstKey});
    assert.equal(second.status, 'HELD');
    assert.deepEqual(keys, ['same-key','same-key']);
    assert.equal(calls, 2);
  } finally {
    if (oldTimeout === undefined) delete process.env.PAYMENT_PROVIDER_TIMEOUT_MS;
    else process.env.PAYMENT_PROVIDER_TIMEOUT_MS = oldTimeout;
    globalThis.fetch = oldFetch;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('outbox retry algorithm is deterministic and bounded', async () => {
  const source = await import('node:fs/promises');
  const fs = await source.default.readFile(new URL('../src/repository/outbox.js', import.meta.url), 'utf8');
  assert.match(fs, /Math\.min\(300, Number\(baseSeconds\) \* Math\.pow\(2, exponent\)\)/);
  assert.match(fs, /0\.75 \+ \(digest\.readUInt16BE\(0\) \/ 0xffff\) \* 0\.5/);
  assert.match(fs, /Math\.min\(300, Math\.max\(1, Math\.round\(capped \* jitterFactor\)\)\)/);
});
