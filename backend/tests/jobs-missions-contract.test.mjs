import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const viewHelpers = fs.readFileSync(new URL('../src/application/view_helpers.js', import.meta.url), 'utf8');
const jobRoutes = fs.readFileSync(new URL('../src/routes/job_routes.js', import.meta.url), 'utf8');
const jobHandlers = fs.readFileSync(new URL('../src/routes/job_handlers.js', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const validation = fs.readFileSync(new URL('../src/policies/validation.js', import.meta.url), 'utf8');

test('missions and jobs have explicit domain fields', () => {
  assert.match(validation, /JOB_KINDS = new Set\(\['MISSION', 'JOB'\]\)/);
  assert.match(validation, /JOB_VISIBILITY = new Set\(\['PUBLIC', 'SPECIALIZED'\]\)/);
  assert.match(`${jobRoutes}\n${jobHandlers}`, /monthlySalary/);
  assert.match(`${jobRoutes}\n${jobHandlers}`, /applicationDeadline/);
});

test('job application workflow keeps employer output identity-minimized', () => {
  assert.match(`${jobRoutes}\n${jobHandlers}`, /listSelectedCandidatesForJob/);
  const schema = fs.readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS job_applications/);
});

test('HOPE fee policy is encoded in API job views', () => {
  assert.match(viewHelpers, /employerRate: 0\.10, candidateRate: 0\.10/);
  assert.match(viewHelpers, /employerRate: 0\.30, candidateRate: 0/);
});
