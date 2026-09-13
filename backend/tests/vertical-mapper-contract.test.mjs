import test from 'node:test';
import assert from 'node:assert/strict';
import { jobFromRow } from '../src/repository/mappers.js';

const baseRow = {
  id: 'j1', owner_id: 'o1', provider_id: null, title: 'T', description: 'D', category_id: 'c1',
  job_type: 'FIXED', budget_type: 'FIXED', budget_min: '10', budget_max: '20', duration: 3,
  acceptance_criteria: 'A', status: 'PUBLISHED', city: null,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', published_at: null,
};

test('legacy rows without the new columns keep working', () => {
  const job = jobFromRow(baseRow);
  assert.equal(job.verticalId, null);
  assert.deepEqual(job.attributes, {});
  assert.equal(job.title, 'T');
  assert.equal(job.kind, 'MISSION');
});

test('vertical_id and attributes are mapped to camelCase', () => {
  const job = jobFromRow({ ...baseRow, vertical_id: 'v-jobs', attributes: { rooms: 3 } });
  assert.equal(job.verticalId, 'v-jobs');
  assert.deepEqual(job.attributes, { rooms: 3 });
});

test('no existing job field changed shape', () => {
  const legacy = jobFromRow(baseRow);
  const keys = Object.keys(legacy);
  assert.equal(keys.at(-2), 'verticalId');
  assert.equal(keys.at(-1), 'attributes');
});
