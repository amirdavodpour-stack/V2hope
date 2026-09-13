import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'production-release.yml'), 'utf8');
const validator = fs.readFileSync(path.join(root, 'backend', 'scripts', 'validate-production-env.sh'), 'utf8');

test('production release env validation uses production data-store secrets', () => {
  const block = workflow.match(/name: Validate production environment contract[\s\S]*?\n      - name: Backend quality gates/)?.[0] || '';
  assert.match(block, /DATABASE_URL:\s*\$\{\{ secrets\.DATABASE_URL_PRODUCTION \}\}/);
  assert.match(block, /S3_BUCKET:\s*\$\{\{ secrets\.S3_BUCKET_PRODUCTION \}\}/);
  assert.match(block, /S3_REGION:\s*\$\{\{ secrets\.S3_REGION_PRODUCTION \}\}/);
  assert.doesNotMatch(block, /STAGING_DATABASE_URL|STAGING_S3_BUCKET/);
});

test('production env validator enforces canonical production storage and payment policy', () => {
  assert.match(validator, /case "\$STORAGE_BACKEND" in s3\)/);
  assert.match(validator, /DATABASE_URL/);
  assert.match(validator, /S3_BUCKET/);
  assert.match(validator, /PUBLIC_BASE_URL/);
  assert.match(validator, /case "\$PAYMENT_PROVIDER" in webhook\)/);
});


test('production environment rejects wildcard CORS entries and insecure custom S3 endpoints', () => {
  assert.match(validator, /some|wildcard/i);
  assert.match(validator, /S3_ENDPOINT must use HTTPS when set in production/);
  const config = fs.readFileSync(path.join(root, 'backend', 'src', 'config.js'), 'utf8');
  assert.match(config, /allowedCorsOrigins\.some/);
  assert.match(config, /s3Endpoint.*https:\/\//);
});

test('production reset delivery policy matches runtime configuration', () => {
  assert.match(validator, /RESET_TOKEN_DELIVERY_MODE=webhook is required in production/);
  assert.match(validator, /RESET_TOKEN_DELIVERY_SECRET must be at least 32 characters/);
  assert.doesNotMatch(validator, /console\|webhook/);
});
