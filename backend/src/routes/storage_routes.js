import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

export function createStorageRoutes({ authUser, storage, config, readBody, readMultipartSingleFile, requireFields, stringField, sendJson, HttpError, repo, legacy, id, now, logEvent }) {
  async function storageRoutes(req, res, parts) {
    const user = await authUser(req);
    if (req.method === 'POST' && parts[1] === 'upload') {
      const file = await readMultipartSingleFile(req);
      try {
        await storage.put(file);
      } finally {
        try { await fs.promises.unlink(file.path); } catch {}
      }
      const data = { key: file.key, filename: file.filename, contentType: file.contentType, size: file.size, uploadedBy: user.id, createdAt: now() };
      const uploadDraft = { id: id(), storageKey: file.key, uploadedBy: user.id, contentType: file.contentType, size: file.size, createdAt: now() };
      try {
        if (process.env.DATABASE_URL) await repo.insertUpload(uploadDraft); else legacy.insertUpload(uploadDraft);
      } catch (error) {
        try { await storage.delete({ key: file.key }); } catch (cleanupError) { logEvent({ level: 'error', action: 'ORPHAN_UPLOAD_CLEANUP_FAILED', key: file.key, message: cleanupError?.message || String(cleanupError) }); }
        throw error;
      }
      return sendJson(res, 201, data);
    }
    if (req.method === 'POST' && parts[1] === 'presign') {
      const body = await readBody(req); requireFields(body, ['filename', 'contentType']);
      const filename = stringField(body.filename, 'filename', { min: 1, max: 255, required: true });
      const contentType = stringField(body.contentType, 'contentType', { min: 1, max: 100, required: true }).toLowerCase();
      if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'].includes(contentType)) throw new HttpError(415, 'UNSUPPORTED_FILE', 'Unsupported content type');
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'upload';
      const key = `${config.s3Prefix}/${crypto.randomUUID()}-${safeName}`;
      try {
        const result = await storage.presignPut({ key, contentType, expiresIn: 300 });
        const intentDraft = { id: id(), storageKey: key, uploadedBy: user.id, contentType, expiresAt: new Date(Date.now() + 300 * 1000).toISOString(), createdAt: now() };
        const intent = process.env.DATABASE_URL ? await repo.createUploadIntent(intentDraft) : legacy.createIntent(intentDraft);
        return sendJson(res, 200, { ...result, intentId: intent.id, uploadedBy: user.id });
      } catch (error) {
        if (error?.message === 'DIRECT_UPLOAD_UNSUPPORTED') throw new HttpError(409, 'DIRECT_UPLOAD_UNSUPPORTED', 'Direct upload requires S3-compatible storage');
        throw error;
      }
    }
    if (req.method === 'POST' && parts[1] === 'complete') {
      const body = await readBody(req); requireFields(body, ['key', 'filename', 'contentType']);
      const key = stringField(body.key, 'key', { min: 1, max: 1024, required: true });
      const filename = stringField(body.filename, 'filename', { min: 1, max: 255, required: true });
      const contentType = stringField(body.contentType, 'contentType', { min: 1, max: 100, required: true }).toLowerCase();
      if (process.env.DATABASE_URL) {
        const existing = await repo.findUploadByKey(key);
        if (existing) {
          if (existing.uploadedBy !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Upload belongs to another user');
          return sendJson(res, 200, { id: existing.id, key, filename, contentType: existing.contentType, size: existing.size, uploadedBy: existing.uploadedBy, createdAt: existing.createdAt });
        }
        const intent = await repo.findUploadIntentForUpdate(key);
        if (!intent) throw new HttpError(403, 'UPLOAD_INTENT_REQUIRED', 'Upload was not reserved by this API');
        if (intent.uploadedBy !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Upload intent belongs to another user');
        if (new Date(intent.expiresAt).getTime() <= Date.now()) throw new HttpError(410, 'UPLOAD_INTENT_EXPIRED', 'Upload intent has expired');
        if (intent.contentType !== contentType) throw new HttpError(415, 'CONTENT_TYPE_MISMATCH', 'Content type does not match the upload intent');
        const head = await storage.head({ key });
        if (!Number.isSafeInteger(head.size) || head.size <= 0) throw new HttpError(400, 'INVALID_UPLOAD_SIZE', 'Stored upload size is invalid');
        if (head.size > config.maxUploadBytes) throw new HttpError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the configured size limit');
        if (head.contentType && head.contentType !== contentType) throw new HttpError(415, 'CONTENT_TYPE_MISMATCH', 'Stored content type does not match the upload intent');
        await storage.validateObject({ key, contentType });
        let completed;
        try { completed = await repo.completeUploadAtomic({ intentId: intent.id, key, userId: user.id, contentType, size: head.size, createdAt: now() }); }
        catch (e) { if (e.code === 'INVALID_UPLOAD_INTENT') throw new HttpError(403, 'INVALID_UPLOAD_INTENT', 'Upload intent is invalid or expired'); throw e; }
        const created = completed.upload;
        return sendJson(res, completed.existing ? 200 : 201, { id: created.id, key, filename, contentType, size: created.size, uploadedBy: created.uploadedBy, createdAt: created.createdAt });
      }
      const existing = legacy.findUploadByKey(key);
      if (existing) { if (existing.uploadedBy !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Upload belongs to another user'); return sendJson(res, 200, existing); }
      const intent = legacy.findIntentByKey(key);
      if (!intent) throw new HttpError(403, 'UPLOAD_INTENT_REQUIRED', 'Upload was not reserved by this API');
      if (intent.uploadedBy !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Upload intent belongs to another user');
      if (new Date(intent.expiresAt).getTime() <= Date.now()) throw new HttpError(410, 'UPLOAD_INTENT_EXPIRED', 'Upload intent has expired');
      if (intent.contentType !== contentType) throw new HttpError(415, 'CONTENT_TYPE_MISMATCH', 'Content type does not match the upload intent');
      const head = await storage.head({ key });
      if (!Number.isSafeInteger(head.size) || head.size <= 0) throw new HttpError(400, 'INVALID_UPLOAD_SIZE', 'Stored upload size is invalid');
      if (head.size > config.maxUploadBytes) throw new HttpError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the configured size limit');
      if (head.contentType && head.contentType !== contentType) throw new HttpError(415, 'CONTENT_TYPE_MISMATCH', 'Stored content type does not match the upload intent');
      await storage.validateObject({ key, contentType });
      const completed = legacy.completeUpload({ key, userId: user.id, contentType, size: head.size, createdAt: now(), filename });
      await legacy.save();
      const created = completed.upload;
      return sendJson(res, completed.existing ? 200 : 201, { id: created.id, key, filename, contentType, size: created.size, uploadedBy: created.uploadedBy, createdAt: created.createdAt });
    }
    throw new HttpError(404, 'NOT_FOUND', 'Storage route not found');
  }
  return storageRoutes;
}
