import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { recordCategoryFailure } from './observability.js';

let S3Client;
let PutObjectCommand;
let HeadObjectCommand;
let GetObjectCommand;
let DeleteObjectCommand;
let getSignedUrl;
if (config.storageBackend === 's3') {
  const clientModule = await import('@aws-sdk/client-s3');
  const presignerModule = await import('@aws-sdk/s3-request-presigner');
  ({ S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } = clientModule);
  ({ getSignedUrl } = presignerModule);
}

const RETRYABLE_S3_ERRORS = new Set(['TimeoutError', 'AbortError', 'NetworkingError']);
function retryDelayMs(attempt) { return Math.min(100 * (2 ** (attempt - 1)), 800); }
function retryable(error) {
  return Boolean(error && (RETRYABLE_S3_ERRORS.has(error.name) || error?.$metadata?.httpStatusCode === 429 || error?.$metadata?.httpStatusCode >= 500));
}

class LocalStorage {
  async put(file) {
    await fs.mkdir(config.storageDir, { recursive:true });
    const destination = path.join(config.storageDir, file.key);
    await fs.rename(file.path, destination);
    return { key:file.key };
  }
  async presignPut() { throw new Error('DIRECT_UPLOAD_UNSUPPORTED'); }
  async head() { throw new Error('DIRECT_UPLOAD_UNSUPPORTED'); }
  async validateObject() { throw new Error('DIRECT_UPLOAD_UNSUPPORTED'); }
  async delete({ key }) { try { await fs.unlink(path.join(config.storageDir, key)); } catch {} }
}
class S3Storage {
  constructor() {
    this.bucket = config.s3Bucket;
    this.client = new S3Client({ region:config.s3Region, endpoint:config.s3Endpoint || undefined, forcePathStyle:config.s3ForcePathStyle });
  }
  async send(command, label) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.client.send(command, { abortSignal: AbortSignal.timeout(10000) });
      } catch (error) {
        recordCategoryFailure('s3');
        if (attempt < 3 && retryable(error)) {
          const delay = retryDelayMs(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        const wrapped = new Error(`S3_${label}_FAILED`);
        wrapped.cause = error;
        throw wrapped;
      }
    }
    throw new Error(`S3_${label}_FAILED`);
  }
  async put(file) {
    const stat = await fs.stat(file.path);
    await this.send(new PutObjectCommand({ Bucket:this.bucket, Key:file.key, Body:createReadStream(file.path), ContentLength:stat.size, ContentType:file.contentType, ServerSideEncryption:config.s3ServerSideEncryption || undefined }), 'PUT');
    return { key:file.key };
  }
  async presignPut({ key, contentType, expiresIn }) {
    const command = new PutObjectCommand({ Bucket:this.bucket, Key:key, ContentType:contentType, ServerSideEncryption:config.s3ServerSideEncryption || undefined });
    return { key, url:await getSignedUrl(this.client, command, { expiresIn }), contentType, expiresIn, mode:'s3' };
  }
  async head({ key }) {
    const result = await this.send(new HeadObjectCommand({ Bucket:this.bucket, Key:key }), 'HEAD');
    return { key, contentType:result.ContentType || '', size:Number(result.ContentLength || 0) };
  }
  async delete({ key }) {
    await this.send(new DeleteObjectCommand({ Bucket:this.bucket, Key:key }), 'DELETE');
  }
  async validateObject({ key, contentType }) {
    const result = await this.send(new GetObjectCommand({ Bucket:this.bucket, Key:key, Range:'bytes=0-4095' }), 'GET');
    const chunks=[]; let total=0;
    for await (const chunk of result.Body) { chunks.push(chunk); total += chunk.length; if (total >= 4096) break; }
    const content=Buffer.concat(chunks).subarray(0,4096);
    const valid = (contentType==='application/pdf' && content.subarray(0,4).toString()==='%PDF') ||
      (contentType==='image/png' && content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
      (contentType==='image/jpeg' && content.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) ||
      (contentType==='image/webp' && content.subarray(0,4).toString()==='RIFF' && content.subarray(8,12).toString()==='WEBP') ||
      (contentType==='text/plain' && !content.includes(0));
    if (!valid) { const error=new Error('INVALID_FILE_SIGNATURE'); error.code='INVALID_FILE_SIGNATURE'; throw error; }
    return { valid:true };
  }
}
export const storage = config.storageBackend === 's3' ? new S3Storage() : new LocalStorage();
