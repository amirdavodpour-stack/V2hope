import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempEnv, startApiServer, register, closeApi } from './support/hope-test-harness.mjs';

const tmp = makeTempEnv('hope-storage-delta-');
const api = await startApiServer();

function auth(token) { return {Authorization: `Bearer ${token}`}; }

async function multipartUpload(token, {filename, contentType, content}) {
  const boundary = '----hope-test-boundary';
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch(api.base + '/storage/upload', {
    method: 'POST',
    headers: {...auth(token), 'content-type': `multipart/form-data; boundary=${boundary}`},
    body: payload,
  });
  return {response, body: await response.json().catch(() => null)};
}

test('valid PDF upload is content-sniffed, stored, and associated with the uploader', async () => {
  const user = await register(api.json, 'storage-pdf@example.com');
  const {response, body} = await multipartUpload(user.accessToken, {
    filename: '../../resume.pdf',
    contentType: 'application/pdf',
    content: '%PDF-1.7\nhello world',
  });
  assert.equal(response.status, 201);
  assert.equal(body.data.contentType, 'application/pdf');
  assert.ok(body.data.key.endsWith('-resume.pdf'));
  assert.equal(body.data.uploadedBy, user.user.id);
  const storedPath = path.join(process.env.STORAGE_DIR, body.data.key);
  assert.equal(fs.existsSync(storedPath), true);
  assert.equal(api.db.collection.uploads.some((x) => x.storageKey === body.data.key && x.uploadedBy === user.user.id), true);
});

test('spoofed image MIME with non-image bytes is rejected by signature validation', async () => {
  const user = await register(api.json, 'storage-spoof@example.com');
  const {response, body} = await multipartUpload(user.accessToken, {
    filename: 'picture.png',
    contentType: 'image/png',
    content: 'definitely-not-a-png',
  });
  assert.equal(response.status, 415);
  assert.equal(body.error.code, 'UNSUPPORTED_FILE');
});

test('empty multipart file is rejected and leaves no upload record', async () => {
  const user = await register(api.json, 'storage-empty@example.com');
  const {response, body} = await multipartUpload(user.accessToken, {
    filename: 'empty.txt',
    contentType: 'text/plain',
    content: '',
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'EMPTY_FILE');
  assert.equal(api.db.collection.uploads.some((x) => x.uploadedBy === user.user.id), false);
});

test('presign never silently falls back to local storage', async () => {
  const user = await register(api.json, 'storage-presign@example.com');
  const r = await api.json('/storage/presign', {
    method: 'POST',
    headers: auth(user.accessToken),
    body: JSON.stringify({filename: 'x.pdf', contentType: 'application/pdf'}),
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'DIRECT_UPLOAD_UNSUPPORTED');
});

test('upload endpoint requires authentication before touching the multipart body', async () => {
  const {response, body} = await multipartUpload('', {
    filename: 'unauth.pdf',
    contentType: 'application/pdf',
    content: '%PDF-1.7',
  });
  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'UNAUTHORIZED');
});

after(async () => closeApi({...api, tmp}));
