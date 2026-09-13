export function createAdminRoutes({ authUser, requireAdmin, readBody, sendJson, HttpError, enumField, adminUseCases, legacyAdmin, config, now, createAudit, findUser, getJob, notifyApplicationCandidate, paymentUseCases, URL }) {
  return async function adminRoutes(req,res,parts){
    const me=requireAdmin(await authUser(req));
    if(req.method==='GET' && parts[0]==='admin' && parts[1]==='finance' && parts.length===3 && parts[2]==='summary'){
      if(process.env.DATABASE_URL){ return sendJson(res,200,await paymentUseCases.adminFinancialSummary()); }
            return sendJson(res,200,{...legacyAdmin.financialSummary(),currency:config.paymentCurrency});
    }
    if(req.method==='GET' && parts[0]==='admin' && parts[1]==='summary'){
      if(process.env.DATABASE_URL){ return sendJson(res,200,await adminUseCases.summary()); }
            return sendJson(res,200,legacyAdmin.summary());
    }
    if(req.method==='GET' && parts[0]==='admin' && parts[1]==='users'){
      const u=process.env.DATABASE_URL ? await adminUseCases.users() : legacyAdmin.users();
      return sendJson(res,200,u.map(x=>({id:x.id,email:x.email,displayName:x.displayName,role:x.role,status:x.status,createdAt:x.createdAt})));
    }
    if(req.method==='POST' && parts[0]==='admin' && parts[1]==='users' && parts[3]==='status'){
      const id=parts[2]; const body=await readBody(req); const status=enumField(body?.status,new Set(['ACTIVE','SUSPENDED']),'status'); if(id===me.id && status==='SUSPENDED') throw new HttpError(400,'SELF_SUSPEND_FORBIDDEN','An admin cannot suspend their own account');
      const updated=process.env.DATABASE_URL ? await adminUseCases.setUserStatus(id,status) : legacyAdmin.setUserStatus(id,status); if(!updated) throw new HttpError(404,'USER_NOT_FOUND','User not found'); if(!process.env.DATABASE_URL) await legacyAdmin.save(); await createAudit('ADMIN_USER_STATUS',me.id,'user',id,{status}); return sendJson(res,200,{id,status:updated.status});
    }
    if(req.method==='GET' && parts[0]==='admin' && parts[1]==='trust-reports'){
      const status=req.url?new URL(req.url,'http://localhost').searchParams.get('status'):null;
      if(process.env.DATABASE_URL){ return sendJson(res,200,await adminUseCases.trustReports(status)); }
      const reports=legacyAdmin.trustReports(status);
      return sendJson(res,200,reports.map(r=>({...r,reporterName:findUser(r.reporterId)?.displayName||null})));
    }
    if(req.method==='POST' && parts[0]==='admin' && parts[1]==='trust-reports' && parts[3]==='status'){
      const id=parts[2]; const body=await readBody(req); const status=enumField(body?.status,new Set(['OPEN','REVIEWING','RESOLVED','DISMISSED']),'status');
      const updated=process.env.DATABASE_URL ? await adminUseCases.updateTrustReportStatus(id,status) : legacyAdmin.updateTrustReportStatus(id,status);
      if(!updated) throw new HttpError(404,'REPORT_NOT_FOUND','Trust report not found'); if(!process.env.DATABASE_URL) await legacyAdmin.save();
      await createAudit('TRUST_REPORT_STATUS',me.id,'trust_report',id,{status}); return sendJson(res,200,{id,status:updated.status});
    }
    if(req.method==='GET' && parts[0]==='admin' && parts[1]==='audit'){
      if(process.env.DATABASE_URL){ return sendJson(res,200,await adminUseCases.audit()); }
      const logs=legacyAdmin.audit();
      return sendJson(res,200,logs);
    }
    if(req.method==='GET' && parts[0]==='admin' && parts[1]==='jobs'){ const jobs=process.env.DATABASE_URL ? await adminUseCases.jobs() : legacyAdmin.jobs(); return sendJson(res,200,jobs); }
    if(req.method==='POST' && parts[0]==='admin' && parts[1]==='jobs' && parts[3]==='moderate'){
      const id=parts[2]; const body=await readBody(req); const status=enumField(body?.status,new Set(['DRAFT','PUBLISHED','CANCELLED']),'status');
      const job=await getJob(id); if(!job) throw new HttpError(404,'JOB_NOT_FOUND','Job not found');
      try { const updated=process.env.DATABASE_URL ? await adminUseCases.moderateJob(id,status) : legacyAdmin.moderateJob(id,status); if(!updated) throw new HttpError(404,'JOB_NOT_FOUND','Job not found'); if(!process.env.DATABASE_URL) await legacyAdmin.save(); await createAudit('ADMIN_JOB_MODERATE',me.id,'job',id,{status}); return sendJson(res,200,updated); } catch(e){ if(e?.code==='JOB_LOCKED') throw new HttpError(409,'JOB_LOCKED','This opportunity is already in a protected lifecycle state'); throw e; }
    }
    if(req.method==='DELETE' && parts[0]==='admin' && parts[1]==='jobs' && parts[2]){
      const id=parts[2]; const job=await getJob(id); if(!job) throw new HttpError(404,'JOB_NOT_FOUND','Job not found');
      if(!['DRAFT','PUBLISHED'].includes(job.status)) throw new HttpError(409,'JOB_NOT_DELETABLE','Only draft or published opportunities can be deleted by admins');
      if(process.env.DATABASE_URL) await adminUseCases.deleteJob(id);
      else {
        try { legacyAdmin.deleteJob(id); } catch (error) {
          if (error?.code === 'JOB_HAS_FINANCIAL_RECORDS') throw new HttpError(409,'JOB_HAS_FINANCIAL_RECORDS','This opportunity has financial records and cannot be deleted');
          throw error;
        }
        await legacyAdmin.save();
      }
      await createAudit('ADMIN_JOB_DELETE',me.id,'job',id); return sendJson(res,200,{deleted:true,id});
    }
    if(req.method==='GET' && parts[0]==='admin' && parts[1]==='applications'){ const apps=process.env.DATABASE_URL ? await adminUseCases.applications() : legacyAdmin.applications(); return sendJson(res,200,apps); }
    if(req.method==='POST' && parts[0]==='admin' && parts[1]==='applications' && parts[3]==='shortlist'){ const id=parts[2]; const changed=process.env.DATABASE_URL ? await adminUseCases.shortlist(id) : legacyAdmin.shortlist(id); if(!changed) throw new HttpError(409,'INVALID_APPLICATION_STATE','Application is not pending'); if(!process.env.DATABASE_URL) await legacyAdmin.save(); await notifyApplicationCandidate(id, 'APPLICATION_SHORTLISTED', 'درخواست شما وارد فهرست کوتاه شد', 'درخواست شما برای بررسی بیشتر انتخاب شده است.'); await createAudit('ADMIN_APPLICATION_SHORTLIST',me.id,'job_application',id); return sendJson(res,200,{id,status:changed.status}); }
    if(req.method==='POST' && parts[0]==='admin' && parts[1]==='applications' && parts[3]==='select'){ const id=parts[2]; const changed=process.env.DATABASE_URL ? await adminUseCases.forward(id) : legacyAdmin.forward(id); if(!changed) throw new HttpError(409,'INVALID_APPLICATION_STATE','Application cannot be forwarded'); if(!process.env.DATABASE_URL) await legacyAdmin.save(); await notifyApplicationCandidate(id, 'APPLICATION_FORWARDED', 'درخواست شما برای کارفرما ارسال شد', 'رزومه و اطلاعات حرفه‌ای شما برای بررسی کارفرما ارسال شده است.'); await createAudit('ADMIN_APPLICATION_FORWARD',me.id,'job_application',id); return sendJson(res,200,{id,status:changed.status}); }
    if(req.method==='POST' && parts[0]==='admin' && parts[1]==='applications' && parts[3]==='reject'){ const id=parts[2]; const changed=process.env.DATABASE_URL ? await adminUseCases.reject(id) : legacyAdmin.reject(id); if(!changed) throw new HttpError(409,'INVALID_APPLICATION_STATE','Application cannot be rejected from its current state'); if(!process.env.DATABASE_URL) await legacyAdmin.save(); await notifyApplicationCandidate(id, 'APPLICATION_REJECTED', 'درخواست شما پذیرفته نشد', 'درخواست شما برای این شغل در این مرحله ادامه پیدا نکرد.'); await createAudit('ADMIN_APPLICATION_REJECT',me.id,'job_application',id); return sendJson(res,200,{id,status:changed.status}); }
    throw new HttpError(404,'NOT_FOUND','Admin route not found');
  };
}
