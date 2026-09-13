import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('geo helpers live in a pure module and keep coordinate safety', async () => {
  const geo = await import('../src/application/geo.js');
  assert.equal(geo.haversineKm(35.6892, 51.3890, 35.6892, 51.3890), 0);
  const tehranShiraz = geo.haversineKm(35.6892, 51.3890, 29.5918, 52.5837);
  assert.ok(tehranShiraz > 600 && tehranShiraz < 900, `Tehran-Shiraz ~${tehranShiraz}km`);
  assert.throws(() => geo.parseCoordinate('abc', 'lat'), (e) => e.code === 'INVALID_COORDINATE' && e.status === 400);
  assert.equal(geo.parseCoordinate('35.5', 'lat'), 35.5);
});

test('rate-limited responses are centralized through sendRateLimited', async () => {
  const { sendRateLimited } = await import('../src/http.js');
  let status = 0;
  let headers = {};
  let body = '';
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    getHeader: () => undefined,
    writeHead: (s, h) => { status = s; headers = { ...headers, ...h }; },
    end: (b) => { body = b; },
  };
  sendRateLimited(res, 'RATE_LIMITED', 'Too many requests', 60);
  assert.equal(status, 429);
  assert.equal(headers['Retry-After'], '60');
  assert.deepEqual(JSON.parse(body), { error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
});

test('file persistence keeps save() durable semantics with coalesced flush scheduling', async () => {
  // Runs in a fresh child process so config.js reads the tmp DATA_FILE before
  // the db module graph is ever loaded (module cache would otherwise pin the
  // repo-default data file from earlier tests in this file).
  const { spawnSync } = await import('node:child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-flush-'));
  const dataFile = path.join(tmp, 'hope.json');
  const dbUrl = new URL('../src/db.js', import.meta.url).href;
  const script = `
    import fs from 'node:fs';
    const { db, initDatabase, seedBaseData } = await import(${JSON.stringify(dbUrl)});
    await initDatabase();
    seedBaseData();
    db.insert('users', { id: 'u-x', email: 'flush@example.com', passwordHash: 'x', displayName: 'Flush', role: 'EMPLOYER', status: 'ACTIVE', sessionVersion: 0, createdAt: new Date().toISOString() });
    db.insert('users', { id: 'u-y', email: 'flush2@example.com', passwordHash: 'x', displayName: 'Flush2', role: 'EMPLOYER', status: 'ACTIVE', sessionVersion: 0, createdAt: new Date().toISOString() });
    await db.save();
    await db.flush();
    const onDisk = JSON.parse(fs.readFileSync(${JSON.stringify(dataFile)}, 'utf8'));
    if (!onDisk.users.some((u) => u.id === 'u-x') || !onDisk.users.some((u) => u.id === 'u-y')) process.exit(3);
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, DATA_FILE: dataFile, STORAGE_DIR: path.join(tmp, 'storage'), NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(child.status, 0, child.stdout + child.stderr);
  fs.rmSync(tmp, { recursive: true, force: true });
});
