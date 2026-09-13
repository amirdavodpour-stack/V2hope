import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hope-sec-'));
process.env.DATA_FILE=path.join(tmp,'hope.json');
process.env.STORAGE_DIR=path.join(tmp,'storage');
process.env.NODE_ENV='test';
process.env.EXPOSE_RESET_TOKEN_IN_DEVELOPMENT='true';
process.env.AUTH_RATE_LIMIT_MAX='20';
process.env.RATE_LIMIT_WINDOW_MS='60000';
process.env.METRICS_TOKEN='metrics-test';
const {createServer}=await import('../src/app.js');
const {db}=await import('../src/db.js');
const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/api/v1`;
const json=(url,opt={})=>fetch(base+url,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}}).then(async r=>({status:r.status,body:await r.json()}));

test('non-owner is rejected from every ownership-guarded job action', async () => {
  const owner = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'authz-owner@example.com', password: 'pass123456789', displayName: 'Owner' }) })).body.data;
  const provider = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'authz-provider@example.com', password: 'pass123456789', displayName: 'Provider' }) })).body.data;
  const attacker = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'authz-attacker@example.com', password: 'pass123456789', displayName: 'Attacker' }) })).body.data;
  const category = (await json('/categories')).body.data[0].id;

  const jobRes = await json('/jobs', { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` }, body: JSON.stringify({ title: 'Authz test job', description: 'Do it', categoryId: category, jobType: 'FIXED', budgetType: 'FIXED', budgetMin: 100, budgetMax: 150, duration: 3, acceptanceCriteria: 'done' }) });
  const job = jobRes.body.data;

  // Attacker cannot publish someone else's job.
  const publishAsAttacker = await json(`/jobs/${job.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${attacker.accessToken}` } });
  assert.equal(publishAsAttacker.status, 403);

  const publish = await json(`/jobs/${job.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } });
  assert.equal(publish.status, 200);

  const offerRes = await json('/offers', { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` }, body: JSON.stringify({ jobId: job.id, price: 120, message: 'bid' }) });
  const offer = offerRes.body.data;

  // Attacker cannot view another owner's offers.
  const viewOffersAsAttacker = await json(`/jobs/${job.id}/offers`, { headers: { Authorization: `Bearer ${attacker.accessToken}` } });
  assert.equal(viewOffersAsAttacker.status, 403);

  // Attacker cannot accept an offer on a job they don't own -- this is the
  // exact guard manual mutation testing found had zero coverage: removing
  // it from app.js caused no test to fail (repository.js's own inner lock
  // check happens to also guard the Postgres path, but the file-mode path
  // this test runs against has no such backstop, and the guard itself was
  // simply never exercised either way).
  const acceptAsAttacker = await json(`/offers/${offer.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${attacker.accessToken}` } });
  assert.equal(acceptAsAttacker.status, 403);

  const accept = await json(`/offers/${offer.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } });
  assert.equal(accept.status, 200);

  // Attacker cannot fund someone else's job.
  const fundAsAttacker = await json(`/payments/fund/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${attacker.accessToken}`, 'Idempotency-Key': 'authz-1' }, body: '{}' });
  assert.equal(fundAsAttacker.status, 403);

  const fund = await json(`/payments/fund/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}`, 'Idempotency-Key': 'authz-1' }, body: '{}' });
  assert.equal(fund.status, 201);

  await json(`/jobs/${job.id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` } });
  await json(`/jobs/${job.id}/evidence`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` }, body: JSON.stringify({ uri: 'https://example.com/evidence' }) });
  await json(`/jobs/${job.id}/deliver`, { method: 'POST', headers: { Authorization: `Bearer ${provider.accessToken}` } });

  // Attacker cannot accept delivery on someone else's job.
  const acceptDeliveryAsAttacker = await json(`/jobs/${job.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${attacker.accessToken}` } });
  assert.equal(acceptDeliveryAsAttacker.status, 403);

  const acceptDelivery = await json(`/jobs/${job.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` } });
  assert.equal(acceptDelivery.status, 200);

  // Attacker cannot release someone else's payment.
  const releaseAsAttacker = await json(`/payments/release/${job.id}`, { method: 'POST', headers: { Authorization: `Bearer ${attacker.accessToken}` } });
  assert.equal(releaseAsAttacker.status, 403);
});

test('upload presign rejects an unsupported content type with a real 415', async () => {
  const user = (await json('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'upload-test@example.com', password: 'pass123456789', displayName: 'Uploader' }) })).body.data;
  const bad = await json('/storage/presign', { method: 'POST', headers: { Authorization: `Bearer ${user.accessToken}` }, body: JSON.stringify({ filename: 'malware.exe', contentType: 'application/x-msdownload' }) });
  assert.equal(bad.status, 415);
  assert.equal(bad.body.error.code, 'UNSUPPORTED_FILE');
});

test('refresh rotates and reusing old token revokes family',async()=>{
  const r=await json('/auth/register',{method:'POST',body:JSON.stringify({email:'rotate@example.com',password:'pass123456789',displayName:'Rotate'})}); assert.equal(r.status,201);
  const first=r.body.data.refreshToken;
  const rotated=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:first})}); assert.equal(rotated.status,200); assert.ok(rotated.body.data.refreshToken);
  const reuse=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:first})}); assert.equal(reuse.status,401); assert.equal(reuse.body.error.code,'REFRESH_REUSE_DETECTED');
  const secondReuse=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:rotated.body.data.refreshToken})}); assert.equal(secondReuse.status,401);
});

test('password reset is one-time and invalidates prior refresh session',async()=>{
  const r=await json('/auth/register',{method:'POST',body:JSON.stringify({email:'reset@example.com',password:'pass123456789',displayName:'Reset'})}); assert.equal(r.status,201); const oldRefresh=r.body.data.refreshToken;
  const req=await json('/auth/password-reset/request',{method:'POST',body:JSON.stringify({email:'reset@example.com'})}); assert.equal(req.status,202); const token=req.body.data.resetToken; assert.ok(token);
  const confirm=await json('/auth/password-reset/confirm',{method:'POST',body:JSON.stringify({token,password:'newpass123456'})});
  assert.equal(confirm.status,200);
  const reuse=await json('/auth/password-reset/confirm',{method:'POST',body:JSON.stringify({token,password:'another123456'})}); assert.equal(reuse.status,400);
  const old=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:oldRefresh})}); assert.equal(old.status,401);
  const login=await json('/auth/login',{method:'POST',body:JSON.stringify({email:'reset@example.com',password:'newpass123456'})}); assert.equal(login.status,200);
});

test('metrics requires the configured token and auth rate limit is active',async()=>{
  const unauth=await fetch(base.replace('/api/v1','')+'/metrics'); assert.equal(unauth.status,401);
  const auth=await fetch(base.replace('/api/v1','')+'/metrics',{headers:{'x-metrics-token':'metrics-test'}}); assert.equal(auth.status,200);
  const attempts=[]; for(let i=0;i<21;i++) attempts.push(await json('/auth/login',{method:'POST',body:JSON.stringify({email:`nope${i}@example.com`,password:'badpass1'})}));
  assert.ok(attempts.some(x=>x.status===429));
});

after(async()=>{await db.close(); await new Promise(r=>server.close(r)); fs.rmSync(tmp,{recursive:true,force:true});});
