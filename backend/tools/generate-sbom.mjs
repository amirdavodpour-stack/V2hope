#!/usr/bin/env node
// Generates a CycloneDX 1.5 SBOM from the application package.json and the
// exact npm package-lock.json tree. This intentionally avoids third-party
// tooling so it is reproducible before/after npm ci.
import fs from 'node:fs';
import crypto from 'node:crypto';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

const components = [];
for (const [location, node] of Object.entries(lock.packages || {})) {
  if (!location || !node || !node.version) continue;
  const name = location.replace(/^node_modules\//, '').split('node_modules/').at(-1);
  if (!name || name === 'hope-api') continue;
  const scope = location.includes('/node_modules/') ? 'optional' : 'required';
  components.push({
    type: 'library',
    name,
    version: node.version,
    purl: `pkg:npm/${encodeURIComponent(name)}@${node.version}`,
    scope,
  });
}

components.sort((a,b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: { type: 'application', name: pkg.name, version: pkg.version },
  },
  components,
};

fs.writeFileSync(new URL('../sbom.json', import.meta.url), JSON.stringify(sbom, null, 2) + '\n');
console.log(`sbom.json written: ${components.length} locked npm components`);
