import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = path.resolve(new URL('..', import.meta.url).pathname);
const projectRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const compose = fs.readFileSync(path.join(backendRoot, 'staging/docker-compose.yml'), 'utf8');
const nginx = fs.readFileSync(path.join(backendRoot, 'staging/nginx/staging.conf'), 'utf8');
const script = fs.readFileSync(path.join(projectRoot, 'tools/staging-local.sh'), 'utf8');

test('staging topology has shared Postgres and two API replicas behind a gateway', () => {
  for (const needle of ['postgres:', 'minio:', 'minio-init:', 'staging-init:', 'api1:', 'api2:', 'gateway:', 'RATE_LIMIT_STORE: postgres', 'STORAGE_BACKEND: s3']) assert.match(compose, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(compose, /DATABASE_URL: postgres:\/\/hope:hope@postgres:5432\/hope/);
  assert.match(compose, /NODE_ENV: staging/);
  assert.match(compose, /S3_ENDPOINT: http:\/\/minio:9000/);
  assert.match(compose, /S3_BUCKET: hope/);
  assert.match(nginx, /least_conn;/);
  assert.match(nginx, /server api1:3000;/);
  assert.match(nginx, /server api2:3000;/);
});

test('staging initialization is a one-shot migration and seed job before both API replicas', () => {
  assert.match(compose, /staging-init:[\s\S]*command: \["sh", "-lc", "node src\/migrate\.js && node src\/seed\.js"\]/);
  assert.match(compose, /api1:[\s\S]*staging-init:\n        condition: service_completed_successfully/);
  assert.match(compose, /api2:[\s\S]*staging-init:\n        condition: service_completed_successfully/);
  assert.doesNotMatch(compose, /api1:[\s\S]*node src\/migrate\.js && node src\/seed\.js && exec node src\/server\.js/);
  assert.doesNotMatch(compose, /api2:[\s\S]*node src\/migrate\.js && node src\/seed\.js && exec node src\/server\.js/);
  assert.match(compose, /STAGING_INSTANCE_ID: api1/);
  assert.match(compose, /STAGING_INSTANCE_ID: api2/);
  assert.match(script, /x-instance-id/i);
  assert.match(script, /export COMPOSE_FILE=/);
  assert.match(compose, /image: minio\/minio:[A-Z0-9._-]+/);
  assert.match(compose, /image: minio\/mc:[A-Z0-9._-]+/);
  assert.match(script, /account\/export/);
  assert.match(script, /api1.*api2|api2.*api1/s);
  assert.match(compose, /api1:[\s\S]*command: \["node", "src\/server\.js"\]/);
  assert.match(compose, /api2:[\s\S]*command: \["node", "src\/server\.js"\]/);
  assert.match(script, /docker compose .* up -d --build/);
  assert.match(script, /curl -fsS http:\/\/127\.0\.0\.1:8088\/ready/);
  assert.match(script, /\/categories/);
});
