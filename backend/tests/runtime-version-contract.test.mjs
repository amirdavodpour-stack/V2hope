import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'package-lock.json'), 'utf8'));
const docker = fs.readFileSync(path.join(root, 'backend', 'Dockerfile'), 'utf8');
const nvm = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
const workflows = fs.readdirSync(path.join(root, '.github', 'workflows'))
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => fs.readFileSync(path.join(root, '.github', 'workflows', name), 'utf8'))
  .join('\n');

test('runtime version is pinned consistently to Node 24', () => {
  assert.equal(pkg.engines?.node, '>=24 <25');
  assert.equal(lock.packages?.['']?.engines?.node, '>=24 <25');
  assert.equal(nvm, '24');
  assert.match(docker, /^FROM node:24-alpine AS deps/m);
  assert.match(docker, /^FROM node:24-alpine$/m);
  assert.doesNotMatch(docker, /node:22-alpine/);
  assert.match(workflows, /node-version:\s*['"]?24['"]?/);
  assert.doesNotMatch(workflows, /node-version:\s*['"]?22['"]?/);
});
