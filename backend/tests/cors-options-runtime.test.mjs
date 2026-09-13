import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTempEnv, startApiServer, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-cors-options-');
const api = await startApiServer();

test('OPTIONS preflight completes with 204 instead of leaving the request hanging', async () => {
  const response = await fetch(api.base + '/live', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://example.test',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
    signal: AbortSignal.timeout(1200),
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://example.test');
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.match(response.headers.get('access-control-allow-methods') || '', /GET/);
  assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  assert.match(response.headers.get('access-control-allow-headers') || '', /Authorization/);
});

after(async () => closeApi({ ...api, tmp }));
