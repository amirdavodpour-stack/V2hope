import { HttpError } from '../api/http_error.js';

/**
 * Attribute schema validation helper.
 *
 * Pure module: no database access, no HTTP, no side effects.
 *
 * A vertical's `config` JSONB may carry an attribute schema:
 *
 *   {
 *     "attributes": [
 *       { "key": "bedrooms", "type": "int", "required": true, "min": 0, "max": 50 },
 *       { "key": "furnished", "type": "bool" },
 *       { "key": "title_deed", "type": "string", "maxLength": 120 },
 *       { "key": "condition", "type": "enum", "options": ["NEW", "USED"] }
 *     ],
 *     "allowUnknownAttributes": false
 *   }
 *
 * The live `jobs` vertical is explicitly EXEMPT: its listings keep an
 * unvalidated `{}` so the shipped vertical cannot regress (see STATE decisions).
 */

export const JOBS_VERTICAL_SLUG = 'jobs';
export const ATTRIBUTE_TYPES = new Set(['string', 'int', 'number', 'bool', 'enum']);
const MAX_ATTRIBUTES = 100;
const DEFAULT_MAX_LENGTH = 2000;

function fail(message, code = 'INVALID_ATTRIBUTES') {
  throw new HttpError(400, code, message);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalise a vertical `config` into a list of attribute definitions.
 * A missing/empty/malformed-but-absent schema yields an empty list, which
 * means "no attributes are defined" (see validateAttributes for the effect).
 */
export function attributeSchemaFromConfig(config) {
  if (!isPlainObject(config)) return { attributes: [], allowUnknown: true };
  const raw = config.attributes;
  const allowUnknown = config.allowUnknownAttributes !== false;
  if (raw === undefined || raw === null) return { attributes: [], allowUnknown };
  if (!Array.isArray(raw)) fail('vertical config.attributes must be an array', 'INVALID_VERTICAL_CONFIG');
  if (raw.length > MAX_ATTRIBUTES) {
    fail(`vertical config.attributes must contain at most ${MAX_ATTRIBUTES} entries`, 'INVALID_VERTICAL_CONFIG');
  }

  const seen = new Set();
  const attributes = raw.map((entry) => {
    if (!isPlainObject(entry)) fail('each attribute definition must be an object', 'INVALID_VERTICAL_CONFIG');
    const key = String(entry.key ?? '').trim();
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(key)) {
      fail(`attribute key "${key}" is invalid`, 'INVALID_VERTICAL_CONFIG');
    }
    if (seen.has(key)) fail(`attribute key "${key}" is duplicated`, 'INVALID_VERTICAL_CONFIG');
    seen.add(key);

    const type = String(entry.type ?? 'string').trim().toLowerCase();
    if (!ATTRIBUTE_TYPES.has(type)) {
      fail(`attribute "${key}" has unsupported type "${type}"`, 'INVALID_VERTICAL_CONFIG');
    }

    const options = Array.isArray(entry.options) ? entry.options.map((o) => String(o)) : [];
    if (type === 'enum' && options.length === 0) {
      fail(`attribute "${key}" of type enum requires options`, 'INVALID_VERTICAL_CONFIG');
    }

    return {
      key,
      type,
      required: entry.required === true,
      options,
      min: Number.isFinite(entry.min) ? Number(entry.min) : null,
      max: Number.isFinite(entry.max) ? Number(entry.max) : null,
      minLength: Number.isFinite(entry.minLength) ? Number(entry.minLength) : null,
      maxLength: Number.isFinite(entry.maxLength) ? Number(entry.maxLength) : DEFAULT_MAX_LENGTH,
    };
  });

  return { attributes, allowUnknown };
}

function coerceValue(def, value) {
  switch (def.type) {
    case 'string': {
      if (typeof value !== 'string') fail(`attribute "${def.key}" must be a string`);
      const text = value.trim();
      if (def.minLength !== null && text.length < def.minLength) {
        fail(`attribute "${def.key}" must be at least ${def.minLength} characters`);
      }
      if (def.maxLength !== null && text.length > def.maxLength) {
        fail(`attribute "${def.key}" must be at most ${def.maxLength} characters`);
      }
      return text;
    }
    case 'int':
    case 'number': {
      if (typeof value === 'boolean') fail(`attribute "${def.key}" must be a number`);
      const num = typeof value === 'number' ? value : Number(String(value).trim());
      if (!Number.isFinite(num)) fail(`attribute "${def.key}" must be a number`);
      if (def.type === 'int' && !Number.isInteger(num)) fail(`attribute "${def.key}" must be an integer`);
      if (def.min !== null && num < def.min) fail(`attribute "${def.key}" must be >= ${def.min}`);
      if (def.max !== null && num > def.max) fail(`attribute "${def.key}" must be <= ${def.max}`);
      return num;
    }
    case 'bool': {
      if (typeof value === 'boolean') return value;
      const text = String(value).trim().toLowerCase();
      if (text === 'true') return true;
      if (text === 'false') return false;
      return fail(`attribute "${def.key}" must be a boolean`);
    }
    case 'enum': {
      const text = String(value).trim();
      if (!def.options.includes(text)) {
        fail(`attribute "${def.key}" must be one of: ${def.options.join(', ')}`);
      }
      return text;
    }
    default:
      return fail(`attribute "${def.key}" has unsupported type`);
  }
}

/**
 * Validate a listing's `attributes` payload against a vertical.
 *
 * @param {object} vertical  vertical row/DTO with `slug` and `config`
 * @param {unknown} attributes  candidate attributes payload
 * @returns {object} normalised attributes safe to persist into jobs.attributes
 */
export function validateAttributes(vertical, attributes) {
  const slug = String(vertical?.slug ?? '').trim().toLowerCase();

  // The live jobs vertical is exempt: never validate, never reshape.
  if (!slug || slug === JOBS_VERTICAL_SLUG) return {};

  if (attributes === undefined || attributes === null) {
    return validateAttributes(vertical, {});
  }
  if (!isPlainObject(attributes)) fail('attributes must be an object');

  const { attributes: defs, allowUnknown } = attributeSchemaFromConfig(vertical?.config);

  // No schema declared -> accept nothing but an empty object unless unknowns allowed.
  const known = new Set(defs.map((d) => d.key));
  if (!allowUnknown) {
    for (const key of Object.keys(attributes)) {
      if (!known.has(key)) fail(`attribute "${key}" is not defined for vertical "${slug}"`, 'UNKNOWN_ATTRIBUTE');
    }
  }

  const out = {};
  for (const def of defs) {
    const value = attributes[def.key];
    const missing = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    if (missing) {
      if (def.required) fail(`attribute "${def.key}" is required`, 'MISSING_ATTRIBUTE');
      continue;
    }
    out[def.key] = coerceValue(def, value);
  }

  if (allowUnknown) {
    for (const [key, value] of Object.entries(attributes)) {
      if (known.has(key)) continue;
      if (value === undefined || value === null) continue;
      if (!/^[a-z][a-z0-9_]{0,49}$/.test(key)) fail(`attribute key "${key}" is invalid`);
      if (isPlainObject(value) || Array.isArray(value)) {
        fail(`attribute "${key}" must be a scalar value`);
      }
      out[key] = typeof value === 'string' ? value.trim().slice(0, DEFAULT_MAX_LENGTH) : value;
    }
  }

  return out;
}
