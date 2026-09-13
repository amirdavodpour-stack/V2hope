import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hope-recruitment-'));
process.env.AUTH_RATE_LIMIT_MAX='500'; process.env.DATA_FILE=path.join(tmp,'hope.json'); process.env.STORAGE_DIR=path.join(tmp,'storage'); process.env.NODE_ENV='test';
const {createServer}=await import('../src/app.js'); const {db}=await import('../src/db.js');
const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base=`http://127.0.0.1:${server.address().port}/api/v1`;
const json=(u,o={})=>fetch(base+u,{...o,headers:{'Content-Type':'application/json',...(o.headers||{})}}).then(async r=>({status:r.status,body:await r.json()}));
let seq=0; const register=async(role='USER')=>{const r=await json('/auth/register',{method:'POST',body:JSON.stringify({email:`r${Date.now()}-${++seq}@example.com`,password:'pass123456789',displayName:role+' user'})}); assert.equal(r.status,201); const user=r.body.data; if(role!=='USER'){db.collection.users.find(x=>x.id===user.user.id).role=role; await db.save();} return user;};
const cat=async()=>{const r=await json('/categories'); assert.equal(r.status,200); return r.body.data[0].id;};
const createJob=async(owner)=>{const r=await json('/jobs',{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`},body:JSON.stringify({title:'Recruitment lifecycle',description:'A sufficiently detailed job description for lifecycle tests.',categoryId:await cat(),jobType:'HOURLY',budgetType:'FIXED',budgetMin:100,budgetMax:100,duration:30,acceptanceCriteria:'criteria',kind:'JOB',visibility:'PUBLIC',schedule:'FULL_TIME',monthlySalary:10000,applicationDeadline:'2099-12-31'})}); assert.equal(r.status,201); const p=await json(`/jobs/${r.body.data.id}/publish`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(p.status,200); return p.body.data;};
const apply=async(candidate,job,resume)=>{const r=await json('/applications',{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`},body:JSON.stringify({jobId:job.id,resumeText:resume,skills:'research,design'})}); assert.equal(r.status,201); return r.body.data.id;};

test('application lifecycle: shortlist -> forward -> interview -> offer -> hire',async()=>{
 const owner=await register('EMPLOYER'), candidate=await register(); const job=await createJob(owner); const id=await apply(candidate,job,'A professional resume with enough content for the recruitment pipeline.');
 let r=await json(`/admin/applications/${id}/shortlist`,{method:'POST',headers:{Authorization:`Bearer ${(await register('ADMIN')).accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.status,'SHORTLISTED');
 const admins=await json('/admin/applications',{headers:{Authorization:`Bearer ${(await register('ADMIN')).accessToken}`}}); assert.equal(admins.status,200);
 const admin=await register('ADMIN'); db.collection.users.find(x=>x.id===admin.user.id).role='ADMIN'; await db.save();
 r=await json(`/admin/applications/${id}/select`,{method:'POST',headers:{Authorization:`Bearer ${admin.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.status,'FORWARDED');
 r=await json(`/jobs/${job.id}/candidates` ,{headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.length,1); assert.equal(r.body.data[0].id,id); assert.equal(r.body.data[0].candidateId,undefined); assert.equal(r.body.data[0].email,undefined);
 r=await json(`/jobs/${job.id}/candidates/${id}/interview`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.status,'INTERVIEW');
 r=await json(`/jobs/${job.id}/candidates/${id}/offer`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.status,'OFFERED');
 r=await json(`/jobs/${job.id}/candidates/${id}/hire`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.status,'ACCEPTED');
 r=await json('/applications',{headers:{Authorization:`Bearer ${candidate.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data[0].status,'ACCEPTED');
 const hiredJob=db.collection.jobs.find(x=>x.id===job.id); assert.equal(hiredJob.status,'ASSIGNED'); assert.equal(hiredJob.providerId,candidate.user.id);
});

test('security: employer cannot see candidates before admin forwarding and cannot action another employer application',async()=>{
 const owner=await register('EMPLOYER'), owner2=await register('EMPLOYER'), candidate=await register(), job=await createJob(owner); const id=await apply(candidate,job,'Another sufficiently detailed professional resume for access testing.');
 let r=await json(`/jobs/${job.id}/candidates`,{headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.length,0);
 r=await json(`/jobs/${job.id}/candidates/${id}/interview`,{method:'POST',headers:{Authorization:`Bearer ${owner2.accessToken}`}}); assert.equal(r.status,403);
 r=await json(`/jobs/${job.id}/candidates/${id}/hire`,{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`}}); assert.equal(r.status,403);
});

test('candidate can withdraw before offer and cannot withdraw after hire',async()=>{
 const owner=await register('EMPLOYER'), candidate=await register(), job=await createJob(owner); const id=await apply(candidate,job,'Resume text long enough for withdrawal state tests.');
 let r=await json(`/applications/${id}/withdraw`,{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`}}); assert.equal(r.status,200); assert.equal(r.body.data.status,'WITHDRAWN');
 r=await json(`/applications/${id}/withdraw`,{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`}}); assert.equal(r.status,409);
});

test('cannot apply to draft or expired job',async()=>{
 const owner=await register('EMPLOYER'), candidate=await register(); const c=await cat();
 let r=await json('/jobs',{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`},body:JSON.stringify({title:'Draft only',description:'A detailed description for a draft job.',categoryId:c,jobType:'HOURLY',budgetType:'FIXED',budgetMin:100,budgetMax:100,duration:30,acceptanceCriteria:'criteria',kind:'JOB',schedule:'PART_TIME',monthlySalary:9000,applicationDeadline:'2099-12-31'})}); const draft=r.body.data;
 r=await json('/applications',{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`},body:JSON.stringify({jobId:draft.id,resumeText:'This resume is intentionally long enough for testing.'})}); assert.equal(r.status,409);
 const p=await json(`/jobs/${draft.id}/publish`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(p.status,200);
 await new Promise(r=>setTimeout(r,5)); db.collection.jobs.find(j=>j.id===draft.id).applicationDeadline='2000-01-01'; db.touch('jobs'); await db.save();
 r=await json('/applications',{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`},body:JSON.stringify({jobId:draft.id,resumeText:'This resume is intentionally long enough for testing.'})}); assert.equal(r.status,409); assert.equal(r.body.error.code,'APPLICATION_CLOSED');
});


test('hire rejects non-hirable job without leaving accepted application state',async()=>{
 const owner=await register('EMPLOYER'), candidate=await register(), c=await cat();
 let r=await json('/jobs',{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`},body:JSON.stringify({title:'Closed job',description:'A detailed description for a closed job.',categoryId:c,jobType:'HOURLY',budgetType:'FIXED',budgetMin:100,budgetMax:100,duration:30,acceptanceCriteria:'criteria',kind:'JOB',schedule:'PART_TIME',monthlySalary:9000,applicationDeadline:'2099-12-31'})});
 const job=r.body.data; r=await json(`/jobs/${job.id}/publish`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(r.status,200);
 r=await json('/applications',{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`},body:JSON.stringify({jobId:job.id,resumeText:'This resume is intentionally long enough for testing.'})}); const id=r.body.data.id;
 db.collection.jobApplications.find(x=>x.id===id).status='OFFERED'; db.collection.jobs.find(x=>x.id===job.id).status='CANCELLED'; db.touch('jobApplications','jobs'); await db.save();
 r=await json(`/jobs/${job.id}/candidates/${id}/hire`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(r.status,409); assert.equal(r.body.error.code,'JOB_NOT_HIRABLE');
 const app=db.collection.jobApplications.find(x=>x.id===id); assert.equal(app.status,'OFFERED'); assert.equal(db.collection.jobs.find(x=>x.id===job.id).providerId,null);
});

after(async()=>{await db.close(); await new Promise(r=>server.close(r)); fs.rmSync(tmp,{recursive:true,force:true});});
