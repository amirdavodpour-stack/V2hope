import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function makeTempEnv(prefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.DATA_FILE = path.join(tmp, 'hope.json');
  process.env.STORAGE_DIR = path.join(tmp, 'storage');
  process.env.NODE_ENV = 'test';
  process.env.AUTH_RATE_LIMIT_MAX = '1000';
  process.env.GENERAL_RATE_LIMIT_MAX = '5000';
  process.env.METRICS_TOKEN = 'metrics-test-token-0123456789abcdef';
  return tmp;
}

export async function startApiServer() {
  const { createServer } = await import('../../src/app.js');
  const { db } = await import('../../src/db.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const json = (url, options = {}) => fetch(base + url, {
    ...options,
    headers: {'content-type': 'application/json', ...(options.headers || {})},
  }).then(async (r) => ({
    status: r.status,
    headers: r.headers,
    body: r.body === null ? null : await r.json().catch(() => null),
  }));
  return { server, db, base, json };
}

export async function register(json, email, displayName = email) {
  const r = await json('/auth/register', {
    method: 'POST',
    body: JSON.stringify({email, password: 'pass123456789', displayName}),
  });
  if (r.status !== 201) throw new Error(`register failed ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data;
}

export async function closeApi({server, db, tmp}) {
  await db.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmp, {recursive: true, force: true});
}
