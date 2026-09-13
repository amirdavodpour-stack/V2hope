import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
let S3Client, CreateBucketCommand, HeadBucketCommand, DeleteObjectCommand;
let s3ImportError = null;
try {
  const sdk = await import('@aws-sdk/client-s3');
  ({ S3Client, CreateBucketCommand, HeadBucketCommand, DeleteObjectCommand } = sdk);
} catch (error) {
  s3ImportError = error;
}

process.env.NODE_ENV = 'test';
process.env.STORAGE_BACKEND = 's3';
process.env.S3_BUCKET = process.env.S3_BUCKET || 'hope-ci';
process.env.S3_REGION = process.env.S3_REGION || 'us-east-1';
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
process.env.S3_FORCE_PATH_STYLE = 'true';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'minioadmin';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin';

const integrationEnabled = process.env.S3_INTEGRATION === '1';
if (process.env.REQUIRE_INTEGRATION === '1' && !integrationEnabled) throw new Error('REQUIRE_INTEGRATION=1 but S3_INTEGRATION is not enabled');
const requireLiveS3 = process.env.S3_REQUIRE_LIVE === '1';
let endpointReachable = false;
if (integrationEnabled && !s3ImportError) {
  try {
    const probe = await fetch(`${process.env.S3_ENDPOINT}/minio/health/live`, {
      signal: AbortSignal.timeout(1500),
    });
    endpointReachable = probe.ok || probe.status === 403 || probe.status === 404;
  } catch {
    endpointReachable = false;
  }
  if (!endpointReachable && requireLiveS3) {
    throw new Error(`S3 endpoint is required but unreachable: ${process.env.S3_ENDPOINT}`);
  }
}
const runS3Integration = integrationEnabled && !s3ImportError && endpointReachable;
const tmp = runS3Integration ? await fsp.mkdtemp(path.join(os.tmpdir(), 'hope-s3-')) : null;
const filePath = tmp ? path.join(tmp, 'sample.pdf') : null;
if (filePath) await fsp.writeFile(filePath, Buffer.from('%PDF-1.7\nHOPE CI\n'));

const client = !s3ImportError ? new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
}) : null;
const storage = runS3Integration ? (await import('../src/storage.js')).storage : null;

const key = 'ci/s3-integration/sample.pdf';

after(async () => {
  if (client) { try { await client.send(new DeleteObjectCommand({ Bucket:process.env.S3_BUCKET, Key:key })); } catch {} client.destroy(); }
  if (tmp) await fsp.rm(tmp, { recursive:true, force:true });
});

test('real S3-compatible storage supports upload, head, and signature validation', { skip: !runS3Integration }, async () => {
  try {
    await client.send(new HeadBucketCommand({ Bucket:process.env.S3_BUCKET }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      await client.send(new CreateBucketCommand({ Bucket:process.env.S3_BUCKET }));
    } else throw error;
  }

  const result = await storage.put({ path:filePath, key, contentType:'application/pdf' });
  assert.equal(result.key, key);
  const head = await storage.head({ key });
  assert.equal(head.key, key);
  assert.equal(head.contentType, 'application/pdf');
  assert.ok(head.size > 0);
  await storage.validateObject({ key, contentType:'application/pdf' });
  const signed = await storage.presignPut({ key:'ci/s3-integration/presigned.pdf', contentType:'application/pdf', expiresIn:60 });
  if (process.env.S3_REQUIRE_HTTPS === '1') assert.match(signed.url, /^https:\/\//);
  else assert.match(signed.url, /http:\/\/127\.0\.0\.1:9000/);
  assert.equal(signed.mode, 's3');
  const payload = Buffer.from('%PDF-1.7\nHOPE PRESIGNED CI\n');
  const uploadResponse = await fetch(signed.url, { method:'PUT', headers:{'content-type':'application/pdf'}, body:payload });
  assert.equal(uploadResponse.ok, true);
  const presignedHead = await storage.head({ key:'ci/s3-integration/presigned.pdf' });
  assert.equal(presignedHead.contentType, 'application/pdf');
  assert.equal(presignedHead.size, payload.length);
  await storage.validateObject({ key:'ci/s3-integration/presigned.pdf', contentType:'application/pdf' });
  await client.send(new DeleteObjectCommand({ Bucket:process.env.S3_BUCKET, Key:'ci/s3-integration/presigned.pdf' }));
  await assert.rejects(() => storage.head({ key:'ci/s3-integration/presigned.pdf' }));
  await client.send(new DeleteObjectCommand({ Bucket:process.env.S3_BUCKET, Key:key }));
  await assert.rejects(() => storage.head({ key }));
});
