import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const evidenceDir = path.join(root, 'artifacts', 'release-evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const now = new Date();
const evidence = {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  platform: `${process.platform}/${process.arch}`,
  hostname: os.hostname(),
  node: process.version,
  commit: process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'UNKNOWN',
  ref: process.env.GITHUB_REF || 'UNKNOWN',
  runId: process.env.GITHUB_RUN_ID || 'LOCAL',
  status: process.env.RELEASE_STATUS || 'UNKNOWN',
  passed: Number(process.env.RELEASE_GATES_PASSED || 0),
  blocked: Number(process.env.RELEASE_GATES_BLOCKED || 0),
};
const out = path.join(evidenceDir, 'release-evidence.json');
fs.writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(out);
