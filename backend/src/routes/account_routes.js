export function createAccountRoutes({ authUser, readBody, sendJson, HttpError, hashPassword, privacyRepo, legacyAccount, storage, anonymizedEmail, deletionCredential, buildDataExport, logEvent }) {
  return async function accountRoutes(req, res, parts) {
    const me = await authUser(req);
    if (req.method === 'GET' && parts[0] === 'export') {
      const bundle = process.env.DATABASE_URL
        ? await privacyRepo.getUserPrivacyBundle(me.id)
        : await legacyAccount.getPrivacyBundle(me.id);
      if (!bundle) throw new HttpError(404,'USER_NOT_FOUND','User not found');
      return sendJson(res,200,buildDataExport(bundle));
    }
    if (req.method === 'POST' && parts[0] === 'delete') {
      const body = await readBody(req);
      if (String(body?.confirmation || '').toUpperCase() !== 'DELETE') throw new HttpError(400,'CONFIRMATION_REQUIRED','Type DELETE to confirm account deletion');
      const deletableUploadKeys = process.env.DATABASE_URL
        ? await privacyRepo.listDeletableUserUploadKeys(me.id)
        : await legacyAccount.listDeletableUserUploadKeys(me.id);
      const replacement = { email: anonymizedEmail(me.id), passwordHash: await hashPassword(deletionCredential()) };
      const deleted = process.env.DATABASE_URL
        ? await privacyRepo.deleteUserPrivacyBundle(me.id, replacement)
        : await legacyAccount.deleteUserPrivacyBundle(me.id, replacement);
      if (!deleted) throw new HttpError(404,'USER_NOT_FOUND','User not found');
      // The database transaction deliberately preserves evidence-referenced
      // objects. Remove only unreferenced personal uploads after the account
      // record is anonymized; cleanup is idempotent for both local and S3
      // storage and must not turn a completed deletion into a 500.
      for (const key of deletableUploadKeys) {
        try { await storage.delete({ key }); }
        catch (error) { logEvent?.({ level: 'error', action: 'ACCOUNT_UPLOAD_CLEANUP_FAILED', key, userId: me.id, message: error?.message || String(error) }); }
      }
      return sendJson(res,200,{deleted:true,privacyVersion:'1.1'});
    }
    throw new HttpError(404,'NOT_FOUND','Account privacy route not found');
  };
}
