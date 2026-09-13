import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const configSource = fs.readFileSync(path.join(root, 'backend/src/config.js'), 'utf8');
const example = fs.readFileSync(path.join(root, 'backend/.env.example'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/CONFIGURATION-CONTRACT.md'), 'utf8');

const configNames = [...configSource.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);
const exampleNames = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
const requiredNames = [...new Set(configNames)].sort();
const ciOnlyNames = ['API_BASE_URL_PRODUCTION'];
const exampleSet = new Set(exampleNames);
const missingExample = requiredNames.filter((name) => !exampleSet.has(name));
assert.deepEqual(missingExample, [], `Missing variables from backend/.env.example: ${missingExample.join(', ')}`);
for (const name of requiredNames) {
  assert.match(docs, new RegExp(`\\b${name}\\b`), `Configuration variable ${name} is missing from docs/CONFIGURATION-CONTRACT.md`);
}
for (const name of ciOnlyNames) {
  assert.match(docs, new RegExp(`\\b${name}\\b`), `CI/release variable ${name} is missing from docs/CONFIGURATION-CONTRACT.md`);
}
assert.match(docs, /\*\*Contract version:\*\*\s*2026-09-06/);
assert.match(docs, /production.*fail-closed/i);
console.log(`Configuration contract PASS: ${requiredNames.length} environment variables documented and exemplified.`);
