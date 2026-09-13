import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hope-finance-'));
process.env.DATA_FILE=path.join(tmp,'hope.json'); process.env.STORAGE_DIR=path.join(tmp,'storage'); process.env.NODE_ENV='test'; process.env.PAYMENT_WEBHOOK_SECRET='test-webhook-secret'; process.env.AUTH_RATE_LIMIT_MAX='1000'; process.env.GENERAL_RATE_LIMIT_MAX='5000';
const { createServer }=await import('../src/app.js');
const { db }=await import('../src/db.js');
const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/api/v1`;
const json=(u,o={})=>fetch(base+u,{...o,headers:{'content-type':'application/json',...(o.headers||{})}}).then(async r=>({status:r.status,body:await r.json()}));
const reg=async(email)=>{const r=await json('/auth/register',{method:'POST',body:JSON.stringify({email,password:'pass123456789',displayName:email})});assert.equal(r.status,201);return r.body.data;};
const category=async()=> (await json('/categories')).body.data[0].id;
const createMission=async(owner)=>{const r=await json('/jobs',{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`},body:JSON.stringify({title:'Mission',description:'Valid mission',categoryId:await category(),jobType:'FIXED',budgetType:'FIXED',budgetMin:1000000,budgetMax:1000000,duration:2,acceptanceCriteria:'Done',city:'تهران',kind:'MISSION',visibility:'PUBLIC'})});assert.equal(r.status,201);const p=await json(`/jobs/${r.body.data.id}/publish`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}});assert.equal(p.status,200);return p.body.data;};

after(()=>server.close());

test('mission funding exposes exact fee breakdown and creates a balanced local ledger', async()=>{
  const owner=await reg('finance-owner@example.com'); const provider=await reg('finance-provider@example.com'); const job=await createMission(owner);
  const offer=await json('/offers',{method:'POST',headers:{Authorization:`Bearer ${provider.accessToken}`},body:JSON.stringify({jobId:job.id,price:1000000,message:'accept'})});assert.equal(offer.status,201);
  const accepted=await json(`/offers/${offer.body.data.id}/accept`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}});assert.equal(accepted.status,200);
  const funded=await json(`/payments/fund/${job.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'fin-1'},body:'{}'});assert.equal(funded.status,201);
  assert.deepEqual(funded.body.data.fees,{baseAmount:1000000,employerFee:100000,workerFee:100000,platformFee:200000,employerCharge:1100000,providerPayout:900000,policyVersion:'2026-08-v1',currency:'USD'});
  const ledger=await json(`/payments/financials/${job.id}`,{headers:{Authorization:`Bearer ${owner.accessToken}`}});assert.equal(ledger.status,200);
  const debit=ledger.body.data.ledger.reduce((s,e)=>s+Number(e.debit||0),0);const credit=ledger.body.data.ledger.reduce((s,e)=>s+Number(e.credit||0),0);assert.equal(debit,credit);assert.equal(ledger.body.data.ledger.length,3);
});

test('fund is idempotent and cannot be refunded twice', async()=>{
  const owner=await reg('refund-owner@example.com'); const provider=await reg('refund-provider@example.com'); const job=await createMission(owner);
  const offer=await json('/offers',{method:'POST',headers:{Authorization:`Bearer ${provider.accessToken}`},body:JSON.stringify({jobId:job.id,price:1000000,message:'accept'})});
  await json(`/offers/${offer.body.data.id}/accept`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}});
  const a=await json(`/payments/fund/${job.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'same'},body:'{}'});assert.equal(a.status,201);
  const b=await json(`/payments/fund/${job.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'same'},body:'{}'});assert.equal(b.status,200);assert.equal(b.body.data.id,a.body.data.id);
  const refund=await json(`/payments/refund/${job.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'refund-1'},body:'{}'});assert.equal(refund.status,200);assert.equal(refund.body.data.status,'REFUNDED');
  const again=await json(`/payments/refund/${job.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'refund-2'},body:'{}'});assert.equal(again.status,409);assert.equal(again.body.error.code,'INVALID_PAYMENT_STATE');
});


test('concurrent funding with distinct idempotency keys creates at most one payment', async () => {
  const owner = await reg('concurrency-owner@example.com');
  const provider = await reg('concurrency-provider@example.com');
  const job = await createMission(owner);
  const offer = await json('/offers', {
    method: 'POST',
    headers: {Authorization: `Bearer ${provider.accessToken}`},
    body: JSON.stringify({jobId: job.id, price: 1000000, message: 'concurrency'}),
  });
  assert.equal(offer.status, 201);
  const accepted = await json(`/offers/${offer.body.data.id}/accept`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${owner.accessToken}`},
  });
  assert.equal(accepted.status, 200);

  const results = await Promise.all(Array.from({length: 20}, (_, i) =>
    json(`/payments/fund/${job.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${owner.accessToken}`,
        'Idempotency-Key': `concurrent-${i}`,
      },
      body: '{}',
    })
  ));

  const successful = results.filter((r) => r.status === 201 || r.status === 200);
  assert.equal(successful.length, 1, `expected exactly one successful fund, got ${successful.length}`);
  assert.equal(results.filter((r) => r.status === 409).length, 19);
  const paymentIds = new Set(successful.map((r) => r.body.data.id));
  assert.equal(paymentIds.size, 1);
  assert.equal(db.collection.payments.filter((p) => p.jobId === job.id).length, 1);
});

test('job funding uses first-month salary and thirty-percent employer commission', async()=>{
  const owner=await reg('job-fee-owner@example.com'); const provider=await reg('job-fee-provider@example.com');
  const r=await json('/jobs',{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`},body:JSON.stringify({title:'Monthly Job',description:'Full time role',categoryId:await category(),jobType:'HOURLY',budgetType:'FIXED',budgetMin:30000000,budgetMax:30000000,duration:30,acceptanceCriteria:'Hire',city:'تهران',kind:'JOB',visibility:'PUBLIC',schedule:'FULL_TIME',monthlySalary:30000000,applicationDeadline:'2099-12-31'})});assert.equal(r.status,201);const pub=await json(`/jobs/${r.body.data.id}/publish`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}});assert.equal(pub.status,200); const offer=await json('/offers',{method:'POST',headers:{Authorization:`Bearer ${provider.accessToken}`},body:JSON.stringify({jobId:r.body.data.id,price:30000000,message:'apply'})}); await json(`/offers/${offer.body.data.id}/accept`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}}); const f=await json(`/payments/fund/${r.body.data.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'job-fee'},body:'{}'}); assert.equal(f.status,201); assert.equal(f.body.data.fees.employerFee,9000000); assert.equal(f.body.data.fees.workerFee,0); assert.equal(f.body.data.fees.employerCharge,39000000); assert.equal(f.body.data.fees.providerPayout,30000000);
});

test('admin financial summary totals fees, charges and payouts', async()=>{
  const admin=await reg('finance-admin@example.com'); db.collection.users.find(u=>u.id===admin.user.id).role='ADMIN'; const summary=await json('/admin/finance/summary',{headers:{Authorization:`Bearer ${admin.accessToken}`}}); assert.equal(summary.status,200); assert.ok(summary.body.data.payments>=1); assert.ok(summary.body.data.platformFees>=0); assert.ok(summary.body.data.ledgerEntries>=1);
});

test('webhook requires signature and replays are harmless', async()=>{
  const owner=await reg('hook-owner@example.com'); const provider=await reg('hook-provider@example.com'); const job=await createMission(owner);
  const offer=await json('/offers',{method:'POST',headers:{Authorization:`Bearer ${provider.accessToken}`},body:JSON.stringify({jobId:job.id,price:1000000,message:'accept'})}); await json(`/offers/${offer.body.data.id}/accept`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`}});
  const f=await json(`/payments/fund/${job.id}`,{method:'POST',headers:{Authorization:`Bearer ${owner.accessToken}`,'Idempotency-Key':'hook-pay'},body:'{}'});assert.equal(f.status,201);
  const eventId='evt-1'; const body=JSON.stringify({eventId,eventType:'PAYMENT_HELD',paymentId:f.body.data.id,providerRef:'WEBHOOK-HELD'});
  const bad=await json('/payments/webhook',{method:'POST',body});assert.equal(bad.status,401);
  const crypto=(await import('node:crypto')).default; const timestamp=Math.floor(Date.now()/1000); const sig='sha256='+crypto.createHmac('sha256',process.env.PAYMENT_WEBHOOK_SECRET).update(`${timestamp}.${eventId}.${body}`).digest('hex');
  const headers={'x-hope-signature':sig,'x-hope-timestamp':String(timestamp),'x-hope-event-id':eventId};
  const good=await json('/payments/webhook',{method:'POST',headers,body});assert.equal(good.status,200);
  const replay=await json('/payments/webhook',{method:'POST',headers,body});assert.equal(replay.status,200);assert.equal(replay.body.data.duplicate,true);
});
