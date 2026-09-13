#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'tests');
const files = fs.readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.mjs') && name !== 's3-integration.test.mjs')
  .sort()
  .map((name) => path.join(testsDir, name));

const env = { ...process.env, NODE_ENV: 'test' };
delete env.DATABASE_URL;

let failed = 0;
let passedFiles = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  process.stdout.write(`\n=== OFFLINE ISOLATED: ${rel} ===\n`);
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', file], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`[offline-isolated] ${rel}: ${result.error.message}`);
    failed += 1;
    continue;
  }
  if (result.status !== 0) {
    console.error(`[offline-isolated] FAIL ${rel} (exit ${result.status})`);
    failed += 1;
  } else {
    passedFiles += 1;
  }
}

console.log(`\nOFFLINE_ISOLATED_SUMMARY files=${files.length} pass=${passedFiles} fail=${failed}`);
process.exit(failed ? 1 : 0);
