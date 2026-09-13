import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attributeSchemaFromConfig,
  validateAttributes,
  JOBS_VERTICAL_SLUG,
} from '../src/policies/attributes.js';

const realEstate = {
  slug: 'real_estate',
  config: {
    allowUnknownAttributes: false,
    attributes: [
      { key: 'bedrooms', type: 'int', required: true, min: 0, max: 50 },
      { key: 'area', type: 'number', min: 1 },
      { key: 'furnished', type: 'bool' },
      { key: 'title', type: 'string', maxLength: 10 },
      { key: 'condition', type: 'enum', options: ['NEW', 'USED'] },
    ],
  },
};

function expectHttpError(fn, code) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.status, 400);
    if (code) assert.equal(error.code, code);
    return error;
  }
  assert.fail('expected validation to throw');
}

test('jobs vertical is exempt and always normalises to {}', () => {
  assert.deepEqual(validateAttributes({ slug: JOBS_VERTICAL_SLUG, config: {} }, { anything: 1 }), {});
  assert.deepEqual(validateAttributes({ slug: 'jobs' }, undefined), {});
  assert.deepEqual(validateAttributes({}, { a: 1 }), {});
});

test('schema parsing normalises defaults', () => {
  const parsed = attributeSchemaFromConfig(realEstate.config);
  assert.equal(parsed.allowUnknown, false);
  assert.equal(parsed.attributes.length, 5);
  assert.equal(parsed.attributes[0].required, true);
  assert.equal(parsed.attributes[1].required, false);
});

test('empty or missing config yields an open, empty schema', () => {
  assert.deepEqual(attributeSchemaFromConfig({}), { attributes: [], allowUnknown: true });
  assert.deepEqual(attributeSchemaFromConfig(null), { attributes: [], allowUnknown: true });
});

test('valid payload is coerced and returned', () => {
  const out = validateAttributes(realEstate, {
    bedrooms: '3',
    area: 88.5,
    furnished: 'true',
    title: 'Villa',
    condition: 'NEW',
  });
  assert.deepEqual(out, { bedrooms: 3, area: 88.5, furnished: true, title: 'Villa', condition: 'NEW' });
});

test('optional attributes may be omitted', () => {
  assert.deepEqual(validateAttributes(realEstate, { bedrooms: 1 }), { bedrooms: 1 });
});

test('required attribute missing is rejected', () => {
  expectHttpError(() => validateAttributes(realEstate, { area: 10 }), 'MISSING_ATTRIBUTE');
});

test('type violations are rejected', () => {
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: 'many' }), 'INVALID_ATTRIBUTES');
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: 1.5 }), 'INVALID_ATTRIBUTES');
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: 1, furnished: 'maybe' }), 'INVALID_ATTRIBUTES');
});

test('range and length bounds are enforced', () => {
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: 99 }));
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: -1 }));
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: 1, title: 'x'.repeat(11) }));
});

test('enum values outside options are rejected', () => {
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: 1, condition: 'BROKEN' }));
});

test('unknown attributes are rejected when allowUnknownAttributes is false', () => {
  expectHttpError(() => validateAttributes(realEstate, { bedrooms: 1, hack: 'x' }), 'UNKNOWN_ATTRIBUTE');
});

test('unknown scalar attributes pass through when unknowns are allowed', () => {
  const vertical = { slug: 'vehicles', config: { attributes: [{ key: 'mileage', type: 'int' }] } };
  assert.deepEqual(validateAttributes(vertical, { mileage: 120, color: ' red ' }), {
    mileage: 120,
    color: 'red',
  });
  expectHttpError(() => validateAttributes(vertical, { nested: { a: 1 } }));
  expectHttpError(() => validateAttributes(vertical, { 'Bad Key': 1 }));
});

test('non-object payloads are rejected for non-jobs verticals', () => {
  expectHttpError(() => validateAttributes(realEstate, 'nope'));
  expectHttpError(() => validateAttributes(realEstate, [1, 2]));
});

test('malformed vertical config is reported distinctly', () => {
  expectHttpError(() => attributeSchemaFromConfig({ attributes: {} }), 'INVALID_VERTICAL_CONFIG');
  expectHttpError(() => attributeSchemaFromConfig({ attributes: [{ key: '1bad', type: 'string' }] }), 'INVALID_VERTICAL_CONFIG');
  expectHttpError(() => attributeSchemaFromConfig({ attributes: [{ key: 'a', type: 'blob' }] }), 'INVALID_VERTICAL_CONFIG');
  expectHttpError(() => attributeSchemaFromConfig({ attributes: [{ key: 'a', type: 'enum' }] }), 'INVALID_VERTICAL_CONFIG');
  expectHttpError(
    () => attributeSchemaFromConfig({ attributes: [{ key: 'a', type: 'string' }, { key: 'a', type: 'int' }] }),
    'INVALID_VERTICAL_CONFIG',
  );
});
