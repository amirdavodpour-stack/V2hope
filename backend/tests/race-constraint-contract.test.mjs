import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('../src/repository/core.js', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
const offers = fs.readFileSync(new URL('../src/routes/offer_routes.js', import.meta.url), 'utf8');
const applications = fs.readFileSync(new URL('../src/routes/application_routes.js', import.meta.url), 'utf8');

test('Offer uniqueness is enforced by the database and translated to the domain error', () => {
  assert.match(schema, /offers_pending_provider_uq/);
  assert.match(schema, /offers\(job_id, provider_id\) WHERE status='PENDING'/);
  assert.match(core, /constraint === 'offers_pending_provider_uq'/);
  assert.match(core, /e\.code='OFFER_EXISTS'/);
  assert.match(offers, /error\?\.code === 'OFFER_EXISTS'/);
});

test('Application uniqueness is enforced by the database and translated to the domain error', () => {
  assert.match(schema, /job_applications_pending_uq/);
  assert.match(schema, /job_applications\(job_id,candidate_id\) WHERE status IN \('PENDING','SELECTED'\)/);
  assert.match(core, /constraint === 'job_applications_pending_uq'/);
  assert.match(core, /e\.code='APPLICATION_EXISTS'/);
  assert.match(applications, /error\?\.code === 'APPLICATION_EXISTS'/);
});
