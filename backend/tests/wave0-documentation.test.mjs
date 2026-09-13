import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('release documentation matches the repository state', () => {
  const readme = read('README.md');
  const checklist = read('RELEASE-CHECKLIST.md');

  assert.match(readme, /\.github\/workflows\/main\.yml/);
  assert.match(readme, /\.github\/workflows\/production-release\.yml/);
  assert.doesNotMatch(readme, /intentionally contains no `\.github\/workflows` build pipeline/i);
  assert.match(readme, /Payments are simulated/i);
  assert.match(readme, /Observability is currently first-party and in-process/i);
  assert.match(readme, /centralized metrics,\s*external alert delivery and distributed tracing/i);

  const pubspec = read('pubspec.yaml');
  const version = pubspec.match(/^version:\s+([0-9]+\.[0-9]+\.[0-9]+)(?:\+\d+)?$/m)?.[1];
  assert.ok(version, 'pubspec version must be parseable');
  assert.match(checklist, new RegExp(`^# HOPE .*${version.replaceAll('.', '\\.') }.*Release Checklist$`, 'm'));
  assert.match(checklist, /## Engineering baseline/);
  assert.match(checklist, /Real PSP adapter and sandbox verification/);
  assert.match(checklist, /Physical Android device QA/);
});

test('operational docs reference scripts by their real repository path', () => {
  const checklist = read('RELEASE-CHECKLIST.md');
  const disasterRecovery = read('DISASTER-RECOVERY.md');
  const contributing = read('CONTRIBUTING.md');
  const docs = { 'RELEASE-CHECKLIST.md': checklist, 'DISASTER-RECOVERY.md': disasterRecovery, 'CONTRIBUTING.md': contributing };
  // Every backtick-quoted path that looks like a script/manifest reference
  // must resolve to a real file, so docs never silently drift from the repo
  // layout (e.g. a `scripts/x.sh` reference left over after a directory move).
  const pathPattern = /`((?:backend\/)?scripts\/[\w.-]+\.sh|backend\/package\.json)`/g;
  for (const [name, text] of Object.entries(docs)) {
    for (const match of text.matchAll(pathPattern)) {
      const referenced = match[1];
      assert.ok(fs.existsSync(path.join(root, referenced)), `${name} references missing path: ${referenced}`);
    }
  }
  assert.match(checklist, /backend\/scripts\/backup\.sh/);
  assert.match(checklist, /backend\/scripts\/restore\.sh/);
  assert.match(disasterRecovery, /backend\/scripts\/restore\.sh/);
});
