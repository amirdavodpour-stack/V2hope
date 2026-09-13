/**
 * Explicit test-runtime adapter for authentication persistence.
 * Production auth routes must use repository interfaces instead.
 */
export function createAuthLegacyAdapter({ db, findUser, issueSession, withTransaction, now }) {
  return Object.freeze({
    createUserWithProvider(user, provider) {
      const created = db.insert('users', user);
      db.insert('providers', provider);
      return created;
    },
    updatePassword(user, passwordHash) {
      user.passwordHash = passwordHash;
      db.touch('users');
    },
    async rotateRefreshToken({ presentedHash, issue }) {
      const item = db.collection.refreshTokens.find((t) => t.tokenHash === presentedHash);
      if (!item || new Date(item.expiresAt).getTime() <= Date.now()) return { kind: 'invalid' };
      if (item.revokedAt) {
        for (const token of db.collection.refreshTokens.filter((t) => t.familyId === item.familyId && !t.revokedAt)) token.revokedAt = now();
        db.touch('refreshTokens'); await db.save();
        return { kind: 'reuse' };
      }
      return withTransaction(async () => {
        const current = db.collection.refreshTokens.find((t) => t.id === item.id);
        if (!current || current.revokedAt) return { kind: 'invalid' };
        const user = findUser(current.userId);
        if (!user || user.status !== 'ACTIVE') return { kind: 'invalid' };
        const issued = await issue(user, current.familyId);
        current.revokedAt = now();
        current.replacedBy = issued.refreshToken; // legacy metadata; reuse detection is based on revoked family state
        db.touch('refreshTokens');
        return { kind: 'ok', issued, user };
      });
    },
    logout(userId) {
      const user = findUser(userId);
      if (!user) return false;
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      db.touch('users');
      for (const token of db.collection.refreshTokens.filter((t) => t.userId === user.id && !t.revokedAt)) token.revokedAt = now();
      db.touch('refreshTokens');
      return true;
    },
    async consumeResetToken(tokenHash, passwordHash) {
      const reset = db.collection.resetTokens.find((t) => t.tokenHash === tokenHash && !t.usedAt && new Date(t.expiresAt).getTime() > Date.now());
      if (!reset) return null;
      const user = findUser(reset.userId);
      if (!user || user.status !== 'ACTIVE') return null;
      user.passwordHash = passwordHash;
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      reset.usedAt = now();
      for (const token of db.collection.refreshTokens.filter((t) => t.userId === user.id && !t.revokedAt)) token.revokedAt = now();
      db.touch('users', 'refreshTokens', 'resetTokens');
      return user;
    },
    insertResetToken(token) {
      return db.insert('resetTokens', token);
    },
    async save() { await db.save(); },
    markResetDeliveryFailed(tokenHash) {
      const created = db.collection.resetTokens.find((t) => t.tokenHash === tokenHash);
      if (created) { created.usedAt = now(); db.touch('resetTokens'); }
    },
  });
}
