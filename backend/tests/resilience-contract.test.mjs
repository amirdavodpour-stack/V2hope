import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const compose = fs.readFileSync(path.join(root, 'backend', 'staging', 'docker-compose.yml'), 'utf8');
const nginx = fs.readFileSync(path.join(root, 'backend', 'staging', 'nginx', 'staging.conf'), 'utf8');
const drill = fs.readFileSync(path.join(root, 'tools', 'staging-resilience-drill.sh'), 'utf8');

 test('staging has two independently addressable API replicas behind one gateway', () => {
  assert.match(compose, /api1:/);
  assert.match(compose, /api2:/);
  assert.match(nginx, /upstream hope_api/);
  assert.match(nginx, /server api1:3000/);
  assert.match(nginx, /server api2:3000/);
});

test('staging replicas share PostgreSQL and S3-compatible object storage', () => {
  assert.match(compose, /DATABASE_URL: postgres:\/\/hope:hope@postgres:5432\/hope/);
  assert.match(compose, /S3_ENDPOINT: http:\/\/minio:9000/);
  assert.match(compose, /S3_BUCKET: hope/);
  assert.match(compose, /RATE_LIMIT_STORE: postgres/);
});

test('resilience drill proves single-replica continuity and full-outage detection', () => {
  assert.match(drill, /stop api1/);
  assert.match(drill, /stop api2/);
  assert.match(drill, /gateway remains healthy with api1 stopped/);
  assert.match(drill, /gateway remains healthy with api2 stopped/);
  assert.match(drill, /both replicas stopped/);
});


test('Wave 19 runtime certification enforces toolchain preflight and DR RTO budget', () => {
  const preflight = fs.readFileSync(path.join(root, 'tools/runtime-certification-preflight.sh'), 'utf8');
  const dr = fs.readFileSync(path.join(root, 'backend/scripts/dr-restore-drill.sh'), 'utf8');
  const staging = fs.readFileSync(path.join(root, '.github/workflows/staging-certification.yml'), 'utf8');
  assert.match(preflight, /node_major.*24|node_major=.*24/s);
  assert.match(preflight, /docker/);
  assert.match(preflight, /flutter/);
  assert.match(preflight, /pg_dump/);
  assert.match(dr, /RTO_TARGET_SECONDS/);
  assert.match(dr, /RTO target exceeded/);
  assert.match(staging, /runtime-certification-preflight\.sh/);
});
