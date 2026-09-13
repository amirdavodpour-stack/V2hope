import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-notifications-'));
process.env.DATA_FILE = path.join(tmp, 'hope.json');
process.env.STORAGE_DIR = path.join(tmp, 'storage');
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.GENERAL_RATE_LIMIT_MAX = '5000';

const { createServer } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const json = (url, options={}) => fetch(base+url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}}).then(async r=>({status:r.status,body:await r.json()}));
async function register(email) { const r=await json('/auth/register',{method:'POST',body:JSON.stringify({email,password:'pass123456789',displayName:email.split('@')[0]})}); assert.equal(r.status,201); return r.body.data; }

test('notification preferences are created with safe defaults and can be updated', async()=>{
  const u=await register('notify-prefs@example.com');
  const first=await json('/notifications/preferences',{headers:{Authorization:`Bearer ${u.accessToken}`}});
  assert.equal(first.status,200); assert.equal(first.body.data.inApp,true); assert.equal(first.body.data.marketing,false);
  const updated=await json('/notifications/preferences',{method:'PUT',headers:{Authorization:`Bearer ${u.accessToken}`},body:JSON.stringify({push:false,email:false,marketing:true})});
  assert.equal(updated.status,200); assert.equal(updated.body.data.push,false); assert.equal(updated.body.data.email,false); assert.equal(updated.body.data.marketing,true);
});

test('notifications are user-scoped, readable once, and support mark-all', async()=>{
  const a=await register('notify-a@example.com'); const b=await register('notify-b@example.com');
  db.insert('notifications',{id:db.id(),userId:a.user.id,type:'TEST',title:'سلام',body:'برای A',data:{dedupeKey:'x'},readAt:null,createdAt:new Date().toISOString()});
  db.insert('notifications',{id:db.id(),userId:b.user.id,type:'TEST',title:'سلام B',body:'برای B',data:{},readAt:null,createdAt:new Date().toISOString()}); db.touch('notifications'); await db.save();
  const list=await json('/notifications',{headers:{Authorization:`Bearer ${a.accessToken}`}}); assert.equal(list.status,200); assert.equal(list.body.data.items.length,1); assert.equal(list.body.data.unreadCount,1);
  const id=list.body.data.items[0].id;
  const read=await json(`/notifications/${id}/read`,{method:'POST',headers:{Authorization:`Bearer ${a.accessToken}`}}); assert.equal(read.status,200); assert.ok(read.body.data.readAt);
  const again=await json('/notifications',{headers:{Authorization:`Bearer ${a.accessToken}`}}); assert.equal(again.body.data.unreadCount,0);
  const cross=await json(`/notifications/${db.collection.notifications.find(n=>n.userId===b.user.id).id}/read`,{method:'POST',headers:{Authorization:`Bearer ${a.accessToken}`}}); assert.equal(cross.status,404);
});

test('notification device registration validates platform and token', async()=>{
  const u=await register('notify-device@example.com');
  const bad=await json('/notifications/devices',{method:'POST',headers:{Authorization:`Bearer ${u.accessToken}`},body:JSON.stringify({platform:'NATIVE',token:'abcdefghijk'})}); assert.equal(bad.status,400);
  const good=await json('/notifications/devices',{method:'POST',headers:{Authorization:`Bearer ${u.accessToken}`},body:JSON.stringify({platform:'ANDROID',token:'abcdefghijk12345'})}); assert.equal(good.status,200);
  const same=await json('/notifications/devices',{method:'POST',headers:{Authorization:`Bearer ${u.accessToken}`},body:JSON.stringify({platform:'ANDROID',token:'abcdefghijk12345'})}); assert.equal(same.status,200);
  assert.equal(db.collection.notificationDevices.filter(x=>x.token==='abcdefghijk12345').length,1);
});

test('notification device lifecycle can list and disable a device', async()=>{
  const u=await register('notify-device-lifecycle@example.com');
  const created=await json('/notifications/devices',{method:'POST',headers:{Authorization:`Bearer ${u.accessToken}`},body:JSON.stringify({platform:'ANDROID',token:'lifecycle-token-12345'})});
  assert.equal(created.status,200);
  const listed=await json('/notifications/devices',{headers:{Authorization:`Bearer ${u.accessToken}`}});
  assert.equal(listed.status,200);
  assert.equal(listed.body.data.items.length,1);
  const disabled=await json(`/notifications/devices/${created.body.data.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${u.accessToken}`}});
  assert.equal(disabled.status,200);
  const after=await json('/notifications/devices',{headers:{Authorization:`Bearer ${u.accessToken}`}});
  assert.equal(after.body.data.items.length,0);
});

test('application flow generates candidate and employer notifications without leaking identity', async()=>{
  const owner=await register('notify-owner@example.com'); const candidate=await register('notify-candidate@example.com');
  const cat=(await json('/categories')).body.data[0].id;
  const created=await json('/jobs',{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`},body:JSON.stringify({title:'Notify Job',description:'A valid opportunity for notifications.',categoryId:cat,jobType:'HOURLY',budgetType:'FIXED',budgetMin:1000,budgetMax:1000,duration:30,acceptanceCriteria:'Valid criteria.',city:'تهران',kind:'JOB',visibility:'PUBLIC',schedule:'FULL_TIME',monthlySalary:30000,applicationDeadline:'2099-12-31'})});
  assert.equal(created.status,201); const pub=await json(`/jobs/${created.body.data.id}/publish`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.equal(pub.status,200);
  const applied=await json('/applications',{method:'POST',headers:{Authorization:`Bearer ${candidate.accessToken}`},body:JSON.stringify({jobId:created.body.data.id,resumeText:'A sufficiently detailed professional resume.',skills:'testing'})}); assert.equal(applied.status,201);
  const ownerNotices=await json('/notifications',{headers:{Authorization:`Bearer ${owner.accessToken}`}}); assert.ok(ownerNotices.body.data.items.some(n=>n.type==='JOB_APPLICATION_RECEIVED'));
  const admin=await register('notify-admin@example.com'); db.collection.users.find(u=>u.id===admin.user.id).role='ADMIN';
  const shortlisted=await json(`/admin/applications/${applied.body.data.id}/shortlist`,{method:'POST',headers:{Authorization:`Bearer ${admin.accessToken}`}}); assert.equal(shortlisted.status,200);
  const candidateNotices=await json('/notifications',{headers:{Authorization:`Bearer ${candidate.accessToken}`}}); assert.ok(candidateNotices.body.data.items.some(n=>n.type==='APPLICATION_SHORTLISTED'));
});

after(async()=>{ await db.close(); await new Promise(r=>server.close(r)); fs.rmSync(tmp,{recursive:true,force:true}); });
