export function createAuthRoutes({
  authUser, authUserView, getUserByEmail, issueSession, deliverPasswordReset, findUser,
  readBody, sendJson, HttpError, requireFields, repo, config, now, hashPassword,
  verifyPassword, passwordNeedsRehash, PASSWORD_MAX_LENGTH, randomToken, sha256, signAccessToken, createAudit, DUMMY_PASSWORD_HASH,
  logEvent, rateLimitAuthAccount, stringField, id, legacy,
}) {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return async function authRoutes(req, res, parts) {
    const route = parts.slice(1).join('/');
    if (req.method === 'POST' && route === 'register') {
      const body = await readBody(req);
      requireFields(body, ['email', 'password', 'displayName']);
      const email = stringField(body.email, 'email', { min: 1, max: 254, required: true }).toLowerCase();
      if (email.length > 254 || !emailRe.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Email is invalid');
      const password = stringField(body.password, 'password', { min: 1, max: PASSWORD_MAX_LENGTH, required: true });
      if (password.length < 12 || password.length > PASSWORD_MAX_LENGTH) throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be between 12 and 128 characters');
      const displayName = stringField(body.displayName, 'displayName', { min: 1, max: 120, required: true });
      if (await getUserByEmail(email)) throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
      const userDraft = { id: id(), email, passwordHash: await hashPassword(password), displayName, role: 'USER', status: 'ACTIVE', sessionVersion: 0, createdAt: now() };
      const providerDraft = { id: id(), userId: userDraft.id, providerType: 'INDIVIDUAL', capacity: 'OPEN', verificationStatus: 'UNVERIFIED', createdAt: now(), updatedAt: now() };
      let user;
      try {
        user = process.env.DATABASE_URL ? await repo.createUserWithProvider(userDraft, providerDraft) : legacy.createUserWithProvider(userDraft, providerDraft);
      } catch (error) {
        if (error?.code === '23505' || error?.constraint === 'users_email_key') throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
        throw error;
      }
      const session = await issueSession(user);
      await createAudit('AUTH_REGISTER', user.id, 'user', user.id);
      return sendJson(res, 201, { ...session, user: authUserView(user) });
    }

    if (req.method === 'POST' && route === 'login') {
      const body = await readBody(req);
      requireFields(body, ['email', 'password']);
      const email = stringField(body.email, 'email', { min: 1, max: 254, required: true }).toLowerCase();
      if (email.length > 254 || !emailRe.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Email is invalid');
      if (rateLimitAuthAccount && !(await rateLimitAuthAccount(email, config.authRateLimitMax, config.rateLimitWindowMs))) {
        throw new HttpError(429, 'RATE_LIMITED', 'Too many authentication requests');
      }
      const user = await getUserByEmail(email);
      // Always perform the expensive password verification step, including for unknown users,
      // to reduce account-enumeration through response-time differences.
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length > PASSWORD_MAX_LENGTH) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
      const passwordOk = await verifyPassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
      if (!user || user.status !== 'ACTIVE' || !passwordOk) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
      if (user.passwordHash && passwordNeedsRehash(user.passwordHash)) {
        const upgradedHash = await hashPassword(password);
        if (process.env.DATABASE_URL) await repo.updatePasswordHash(user.id, upgradedHash);
        else { legacy.updatePassword(user, upgradedHash); await legacy.save(); }
        user.passwordHash = upgradedHash;
      }
      const session = await issueSession(user);
      await createAudit('AUTH_LOGIN', user.id, 'user', user.id);
      return sendJson(res, 200, { ...session, user: authUserView(user) });
    }

    if (req.method === 'POST' && route === 'refresh') {
      const body = await readBody(req);
      requireFields(body, ['refreshToken']);
      const refreshToken = stringField(body.refreshToken, 'refreshToken', { min: 32, max: 256, required: true });
      const presentedHash = sha256(refreshToken);
      // Throttle refresh attempts per presented token so a stolen/leaked
      // refresh token cannot be brute-forced or replayed at full speed.
      if (rateLimitAuthAccount && !(await rateLimitAuthAccount(`refresh:${presentedHash.slice(0, 32)}`, config.authRateLimitMax, config.rateLimitWindowMs))) {
        throw new HttpError(429, 'RATE_LIMITED', 'Too many refresh attempts');
      }
      if (process.env.DATABASE_URL) {
        const refresh = randomToken(48);
        const nextToken = { id:id(), tokenHash:sha256(refresh), familyId:id(), expiresAt:new Date(Date.now()+config.refreshTtlSeconds*1000).toISOString(), createdAt:now() };
        const existing = await repo.findRefreshTokenByHash(presentedHash);
        if (!existing || new Date(existing.expiresAt).getTime() <= Date.now()) throw new HttpError(401,'INVALID_REFRESH_TOKEN','Refresh token is invalid or expired');
        nextToken.familyId = existing.familyId;
        const rotated = await repo.rotateRefreshToken(presentedHash,nextToken,existing.familyId);
        if (rotated.kind === 'reuse') throw new HttpError(401,'REFRESH_REUSE_DETECTED','Refresh token reuse detected; session family revoked');
        if (rotated.kind !== 'ok' || rotated.user.status !== 'ACTIVE') throw new HttpError(401,'INVALID_REFRESH_TOKEN','Refresh token is invalid');
        const issued = { accessToken:signAccessToken({sub:rotated.user.id,role:rotated.user.role,sv:Number(rotated.user.sessionVersion || 0)},config.accessSecret,config.accessTtlSeconds,{issuer:config.accessIssuer,audience:config.accessAudience}), refreshToken:refresh };
        return sendJson(res,200,{...issued,user:authUserView(rotated.user)});
      }
      const next = await legacy.rotateRefreshToken({ presentedHash, issue: issueSession });
      if (next.kind === 'reuse') throw new HttpError(401, 'REFRESH_REUSE_DETECTED', 'Refresh token reuse detected; session family revoked');
      if (next.kind !== 'ok') throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
      return sendJson(res, 200, { ...next.issued, user: authUserView(next.user) });
    }

    if (req.method === 'POST' && route === 'logout') {
      const user = await authUser(req);
      if (process.env.DATABASE_URL) { await repo.revokeUserRefreshTokens(user.id); await repo.bumpUserSessionVersion(user.id); }
      else { legacy.logout(user.id); await legacy.save(); }
      await createAudit('AUTH_LOGOUT', user.id, 'user', user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && route === 'password-reset/confirm') {
      const body = await readBody(req);
      requireFields(body, ['token', 'password']);
      const token = stringField(body.token, 'token', { min: 1, max: 256, required: true });
      const password = stringField(body.password, 'password', { min: 1, max: PASSWORD_MAX_LENGTH, required: true });
      if (password.length < 12 || password.length > PASSWORD_MAX_LENGTH) throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be between 12 and 128 characters');
      if (process.env.DATABASE_URL) {
        const candidate = await repo.findResetTokenForUse(sha256(token));
        if (!candidate || candidate.user.status !== 'ACTIVE') throw new HttpError(400,'INVALID_RESET_TOKEN','Reset token is invalid or expired');
        const ok = await repo.consumeResetTokenAndChangePassword(candidate.token.id,candidate.user.id,await hashPassword(password));
        if (!ok) throw new HttpError(400,'INVALID_RESET_TOKEN','Reset token is invalid or already used');
        await createAudit('AUTH_PASSWORD_RESET', candidate.user.id, 'user', candidate.user.id);
        return sendJson(res,200,{ok:true});
      }
      const user = await legacy.consumeResetToken(sha256(token), await hashPassword(password));
      if (!user) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
      await legacy.save(); await createAudit('AUTH_PASSWORD_RESET', user.id, 'user', user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && route === 'password-reset/request') {
      const body = await readBody(req);
      requireFields(body, ['email']);
      const email = stringField(body.email, 'email', { min: 1, max: 254, required: true }).toLowerCase();
      if (email.length > 254 || !emailRe.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Email is invalid');
      if (rateLimitAuthAccount && !(await rateLimitAuthAccount(`reset:${email}`, config.authRateLimitMax, config.rateLimitWindowMs))) {
        throw new HttpError(429, 'RATE_LIMITED', 'Too many authentication requests');
      }
      const user = await getUserByEmail(email);
      const generic = { ok: true, message: 'If the account exists, a reset request has been created.' };
      if (!user) return sendJson(res, 202, generic);
      const token = randomToken(32);
      const resetDraft = { id: id(), userId: user.id, tokenHash: sha256(token), familyId:id(), expiresAt: new Date(Date.now() + config.resetTokenTtlSeconds * 1000).toISOString(), usedAt: null, createdAt: now() };
      if (process.env.DATABASE_URL) await repo.insertResetToken(resetDraft); else legacy.insertResetToken(resetDraft);
      try {
        await deliverPasswordReset({ user, token });
      } catch (error) {
        if (!process.env.DATABASE_URL) legacy.markResetDeliveryFailed(sha256(token));
        logEvent({ level:'error', action:'PASSWORD_RESET_DELIVERY_FAILED', userId:user.id, message:error.message });
        // Keep the external response generic even when delivery fails so the endpoint does not
        // become an account-enumeration oracle based on status code.
        return sendJson(res, 202, generic);
      }
      logEvent({ level: 'info', action: 'PASSWORD_RESET_REQUESTED', userId: user.id });
      return sendJson(res, 202, config.exposeResetTokenInDevelopment && process.env.NODE_ENV !== 'production' ? { ...generic, resetToken: token } : generic);
    }
    throw new HttpError(404, 'NOT_FOUND', 'Auth route not found');
  };
}
