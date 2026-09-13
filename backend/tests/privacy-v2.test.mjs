import { readFileSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTelemetryProperties, anonymizedEmail, buildDataExport } from '../src/privacy.js';

test('privacy sanitizer removes direct identifiers and bounds long strings', () => {
  const value = sanitizeTelemetryProperties({email:'a@b.c',name:'Alice',ok:true,description:'x'.repeat(500)});
  assert.equal(value.email, undefined);
  assert.equal(value.name, undefined);
  assert.equal(value.ok, true);
  assert.equal(value.description.length, 200);
});

test('deleted email is non-routable and deterministic per user', () => {
  assert.match(anonymizedEmail('abc-123'), /^deleted\+abc-123@invalid\.local$/);
});

test('data export omits payment credentials', () => {
  const out=buildDataExport({user:{id:'u1',email:'a@b.c',displayName:'A',role:'USER',status:'ACTIVE',createdAt:'now'}});
  assert.equal(out.exportVersion,'1.2');
  assert.deepEqual(out.evidence,[]);
  assert.deepEqual(out.uploads,[]);
  assert.ok(!('providerRef' in (out.payments[0] || {})));
});


test('password reset delivery never logs the reset token', () => {
  const source = readFileSync(path.join(ROOT, 'src/services/session.js'), 'utf8');
  assert.ok(source.includes("action: 'PASSWORD_RESET_DELIVERY'"));
  const segment = source.slice(source.indexOf("action: 'PASSWORD_RESET_DELIVERY'"), source.indexOf("return;", source.indexOf("action: 'PASSWORD_RESET_DELIVERY'")));
  assert.doesNotMatch(segment, /token\s*[,}]/);
});


test('PostgreSQL privacy export selects the notifications schema columns', () => {
  const repository = [
    readFileSync(path.join(ROOT, 'src/repository/privacy.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src/repository/privacy.js'), 'utf8'),
  ].join('\n');
  assert.match(repository, /SELECT id,type,title,body,created_at,read_at FROM notifications WHERE user_id=\$1/);
  assert.doesNotMatch(repository, /SELECT id,type,title,message,created_at,read_at FROM notifications/);
  assert.match(repository, /notifications:n\.rows\.map\(r=>\(\{id:r\.id,type:r\.type,title:r\.title,body:r\.body/);
});


test('data export contract uses body for notifications', () => {
  const out=buildDataExport({
    user:{id:'u2',email:'a@b.c',displayName:'A',role:'USER',status:'ACTIVE',createdAt:'now'},
    notifications:[{id:'n1',type:'TEST',title:'Title',body:'Body',createdAt:'now',readAt:null}],
  });
  assert.deepEqual(out.notifications, [{id:'n1',type:'TEST',title:'Title',body:'Body',createdAt:'now',readAt:null}]);
  assert.equal(out.notifications[0].message, undefined);
});


test('data export includes user-owned telemetry and trust reports', () => {
  const out=buildDataExport({
    user:{id:'u3',email:'a@b.c',displayName:'A',role:'USER',status:'ACTIVE',createdAt:'now'},
    analyticsEvents:[{id:'a1',eventName:'screen_view',userId:'u3'}],
    crashReports:[{id:'c1',fingerprint:'fp',message:'boom',userId:'u3'}],
    trustReports:[{id:'t1',reporterId:'u3',entityType:'USER',entityId:'u4',reason:'spam',status:'OPEN'}],
  });
  assert.equal(out.analyticsEvents.length,1);
  assert.equal(out.crashReports.length,1);
  assert.equal(out.trustReports.length,1);
});


test('data export strips internal payment and telemetry transport fields recursively', () => {
  const out=buildDataExport({
    user:{id:'u4',email:'a@b.c',displayName:'A',role:'USER',status:'ACTIVE',createdAt:'now'},
    payments:[{id:'p1',amount:10,providerRef:'secret-ref',idempotencyKey:'secret-key'}],
    analyticsEvents:[{id:'a1',eventName:'x',dedupeKey:'internal-dedupe',properties:{iban:'secret',ok:true}}],
    crashReports:[{id:'c1',message:'boom',stack:'stack',context:{token:'secret',safe:true}}],
    provider:{id:'pr1',providerRef:'secret-provider',verificationStatus:'VERIFIED'},
  });
  assert.equal(out.payments[0].providerRef, undefined);
  assert.equal(out.payments[0].idempotencyKey, undefined);
  assert.equal(out.analyticsEvents[0].dedupeKey, undefined);
  assert.equal(out.analyticsEvents[0].properties.iban, undefined);
  assert.equal(out.analyticsEvents[0].properties.ok, true);
  assert.equal(out.crashReports[0].context.token, undefined);
  assert.equal(out.provider.providerRef, undefined);
});
