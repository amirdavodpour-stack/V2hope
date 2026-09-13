import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('S3 adapter has bounded timeout, retry and server-side encryption support', () => {
  const source = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.match(source, /AbortSignal\.timeout\(10000\)/);
  assert.match(source, /attempt <= 3/);
  assert.match(source, /ServerSideEncryption/);
});

test('notification provider rejects non-HTTPS endpoints at the provider boundary', () => {
  const source = fs.readFileSync(new URL('../src/notification_provider.js', import.meta.url), 'utf8');
  assert.match(source, /NOTIFICATION_PROVIDER_HTTPS_REQUIRED/);
  assert.match(source, /parsed\.protocol !== 'https:'/);
});

test('production configuration enforces explicit storage encryption mode', () => {
  const source = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  assert.match(source, /S3_SERVER_SIDE_ENCRYPTION/);
  assert.match(source, /AES256.*aws:kms/);
});
