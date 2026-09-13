// Candidate application routes.

export function createApplicationRoutes({ authUser, readBody, sendJson, HttpError, requireFields, textField, repo, applicationUseCases, legacy, id, now, getJob, createAudit, notifyUser, NOTIFICATION_TYPES }) {
  return async function routeHandler(req, res, parts) {
    if (req.method === 'POST' && parts[0] === 'applications' && parts.length === 3 && parts[2] === 'withdraw') {
      const me = await authUser(req);
      const id = parts[1];
      let changed = null;
      changed = process.env.DATABASE_URL ? await applicationUseCases.withdraw(id, me.id) : legacy.withdraw(id, me.id);
      if (!process.env.DATABASE_URL && changed) await legacy.save();
      if (!changed) throw new HttpError(409,'INVALID_APPLICATION_STATE','Application cannot be withdrawn from its current state');
      await createAudit('JOB_APPLICATION_WITHDRAW', me.id, 'job_application', id);
      return sendJson(res,200,{id:changed.id,status:changed.status});
    }
    if (req.method === 'GET' && parts.length === 1) {
      const me = await authUser(req);
      const applications = process.env.DATABASE_URL ? await repo.listCandidateApplications(me.id) : legacy.listForCandidate(me.id);
      return sendJson(res,200,applications.map(({candidateId,...safe})=>safe));
    }
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'admin') {
      throw new HttpError(404,'NOT_FOUND','Use admin application routes');
    }
    if (req.method === 'POST' && parts.length === 1) {
      const me = await authUser(req); const body = await readBody(req); requireFields(body, ['jobId','resumeText']);
      const job = await getJob(String(body.jobId)); if (!job) throw new HttpError(404,'JOB_NOT_FOUND','Job not found');
      if ((job.kind || (job.jobType === 'FIXED' ? 'MISSION' : 'JOB')) !== 'JOB') throw new HttpError(400,'JOB_ONLY','Applications are only available for jobs');
      if (job.status !== 'PUBLISHED') throw new HttpError(409,'APPLICATION_CLOSED','This job is not accepting applications');
      if (job.ownerId === me.id) throw new HttpError(403,'FORBIDDEN','Owners cannot apply to their own job');
      if (job.applicationDeadline) {
        const deadline = new Date(`${String(job.applicationDeadline).slice(0, 10)}T23:59:59.999Z`);
        if (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now()) throw new HttpError(409,'APPLICATION_CLOSED','Application deadline has passed');
      }
      const existing = process.env.DATABASE_URL ? await applicationUseCases.find(job.id,me.id) : legacy.find(job.id, me.id);
      if(existing) throw new HttpError(409,'APPLICATION_EXISTS','You already applied to this job');
      const resumeText=textField(body.resumeText,'resumeText',{min:10,max:12000,required:true}); const skills=textField(body.skills || '','skills',{min:0,max:2000});
      const draft={id:(process.env.DATABASE_URL ? id : legacy.newId)(),jobId:job.id,candidateId:me.id,resumeText,skills,status:'PENDING',createdAt:now(),updatedAt:now()};
      let created;
      try { created=process.env.DATABASE_URL?await repo.insertJobApplication(draft):legacy.create(draft); }
      catch (error) { if (error?.code === 'APPLICATION_EXISTS') throw new HttpError(409,'APPLICATION_EXISTS','You already applied to this job'); throw error; }
      await notifyUser({userId:job.ownerId,type:NOTIFICATION_TYPES.JOB_APPLICATION_RECEIVED,title:'درخواست جدید برای شغل شما',body:`برای «${job.title}» یک درخواست جدید دریافت کردید.`,data:{jobId:job.id,applicationId:created.id},dedupeKey:`application:${created.id}:owner`,channels:['IN_APP','PUSH','EMAIL']});
      await createAudit('JOB_APPLICATION_CREATE',me.id,'job_application',created.id,{jobId:job.id}); return sendJson(res,201,{id:created.id,status:created.status});
    }
    throw new HttpError(404,'NOT_FOUND','Application route not found');
  };
}
