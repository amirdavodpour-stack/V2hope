import { handleList, handleCreate, handleMine, handleJobActions, handleCandidateRoutes } from './job_handlers.js';

export function createJobRoutes(ctx) {
  return async function routeHandler(req, res, parts) {
    const user = req.headers.authorization ? await ctx.authUser(req) : null;
    if (req.method === 'GET' && parts.length === 1) return handleList(ctx, req, res, parts, user);
    if (req.method === 'POST' && parts.length === 1) return handleCreate(ctx, req, res, parts, user);
    if (req.method === 'GET' && parts[1] === 'mine') return handleMine(ctx, req, res, parts, user);
    if (parts.length < 2) throw new ctx.HttpError(404, 'NOT_FOUND', 'Job route not found');
    const job = await ctx.getJob(parts[1]);
    if (!job) throw new ctx.HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (req.method === 'GET' && parts.length === 2) {
      if (job.status !== 'PUBLISHED' && (!user || (job.ownerId !== user.id && job.providerId !== user.id))) {
        throw new ctx.HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
      }
      return ctx.sendJson(res, 200, await ctx.jobView(job, user?.id));
    }
    const action = await handleJobActions(ctx, req, res, parts, job);
    if (action !== undefined) return action;
    const candidate = await handleCandidateRoutes(ctx, req, res, parts, job);
    if (candidate !== undefined) return candidate;
    throw new ctx.HttpError(404, 'NOT_FOUND', 'Job route not found');
  };
}
