export function createProviderRoutes({ authUser, getProvider, publicUser, repo, sendJson, HttpError, now, id, insertProvider, legacy = {} }) {
  return async function providerRoutes(req, res, parts) {
    if (req.method !== 'GET' || parts[1] !== 'me') throw new HttpError(404, 'NOT_FOUND', 'Provider route not found');
    const user = await authUser(req);
    let provider = await getProvider(user.id);
    if (!provider) {
      const draft={ id: id(), userId: user.id, providerType:'INDIVIDUAL', capacity:'OPEN', verificationStatus:'UNVERIFIED', createdAt:now(), updatedAt:now() };
      provider = process.env.DATABASE_URL ? await repo.upsertProvider(draft) : insertProvider(draft);
    }
    const trustSignals = process.env.DATABASE_URL
      ? await repo.getPublicTrustSignals(user.id)
      : (() => {
          const createdAt = user.createdAt || now();
          const completedJobs = (legacy.jobs || []).filter((j) => j.providerId === user.id && j.status === 'COMPLETED').length;
          const activeJobs = (legacy.jobs || []).filter((j) => j.providerId === user.id && j.status === 'IN_PROGRESS').length;
          const verificationStatus = String(provider.verificationStatus || 'UNVERIFIED').toUpperCase();
          return {
            verificationStatus,
            verified: verificationStatus === 'VERIFIED',
            completedJobs,
            activeJobs,
            memberSince: createdAt,
          };
        })();
    return sendJson(res, 200, { ...provider, user: publicUser(user), trustSignals });
  };
}
