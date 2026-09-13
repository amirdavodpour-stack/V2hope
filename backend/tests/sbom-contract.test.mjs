import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const sbom = JSON.parse(fs.readFileSync(new URL('../sbom.json', import.meta.url), 'utf8'));

const stripRange = (v) => v.replace(/^[\^~]/, '');
const expected = (deps) => Object.entries(deps || {})
  .map(([name, version]) => `${name}@${stripRange(version)}`)
  .sort();
const directNames = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]);

test('sbom.json includes the exact locked dependency tree', () => {
  const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const locked = Object.entries(lock.packages || {})
    .filter(([location, node]) => location && node?.version)
    .map(([location, node]) => `${location.replace(/^node_modules\//, '').split('node_modules/').at(-1)}@${node.version}`)
    .sort();
  const have = sbom.components.map((c) => `${c.name}@${c.version}`).sort();
  assert.deepEqual(have, locked, 'sbom.json is out of date with package-lock.json -- run `npm run sbom`');
  assert.ok(have.length > Object.keys(pkg.dependencies || {}).length, 'SBOM must include transitive dependencies');
});

test('direct runtime dependencies are marked required in the SBOM', () => {
  const required = sbom.components.filter((c) => c.scope === 'required').map((c) => c.name);
  for (const name of Object.keys(pkg.dependencies || {})) assert.ok(required.includes(name), `${name} must be required`);
  assert.ok(required.length >= Object.keys(pkg.dependencies || {}).length);
});

test('sbom.json declares a bomFormat and application component', () => {
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.metadata.component.name, pkg.name);
  assert.equal(sbom.metadata.component.version, pkg.version);
});
