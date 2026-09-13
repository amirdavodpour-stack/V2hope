/**
 * S19 — backend/tools/ingest-evidence.mjs
 *
 * Every fixture lives under os.tmpdir(). These tests must NEVER create a file in
 * docs/audit/evidence/ — that directory is required to contain only README.md.
 * The `--into` override exists precisely so this suite can prove write behaviour
 * without touching the real evidence directory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  DEFAULT_EVIDENCE_DIR,
  KNOWN_GATES,
  findCandidates,
  formatReport,
  ingest,
  parseArgs,
} from '../tools/ingest-evidence.mjs';
import { EVIDENCE_MAX_AGE_DAYS } from '../tools/90plus-score.mjs';

// Resolved from this file's own location, not from process.cwd(): npm runs the
// suite with cwd=backend, but a future session running `node --test` from the repo
// root would otherwise get 22 confusing path failures that look like regressions.
const backendRootForTest = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const toolPath = path.join(backendRootForTest, 'tools', 'ingest-evidence.mjs');
const GATE = 'postgres_runtime';
const RUN_URL = 'https://github.com/hope/hope/actions/runs/987654321/attempts/1';

const tmpRoots = [];
function tmp(prefix = 'hope-ingest-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpRoots.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
});

function passDoc(overrides = {}) {
  return {
    gate: GATE,
    result: 'pass',
    logUrl: RUN_URL,
    ranAt: new Date().toISOString(),
    note: 'staging certification postgres suite',
    ...overrides,
  };
}

/** Build a `--from` bundle that mimics an unzipped artifact: nested one level. */
function bundle(files) {
  const from = tmp();
  const nested = path.join(from, 'staging-runtime-evidence-123', 'evidence');
  fs.mkdirSync(nested, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(
      path.join(nested, name),
      typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    );
  }
  return from;
}

function run(from, extra = []) {
  const into = tmp('hope-ingest-into-');
  try {
    const stdout = execFileSync('node', [toolPath, '--from', from, '--into', into, ...extra], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '', into };
  } catch (err) {
    return {
      code: err.status,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? ''),
      into,
    };
  }
}

// ---------------------------------------------------------------- invocation

test('parseArgs requires --from and defaults --dry-run to OFF', () => {
  assert.deepEqual(parseArgs(['--from', '/x']), {
    from: '/x',
    dryRun: false,
    into: null,
    help: false,
  });
  assert.equal(parseArgs(['--from', '/x', '--dry-run']).dryRun, true);
  assert.throws(() => parseArgs([]), /--from <dir> is required/);
  assert.throws(() => parseArgs(['--result', 'pass']), /unknown argument/);
});

test('the module is importable without side effects (isMain guard)', () => {
  // Importing above already ran the module; if the CLI body were unguarded it
  // would have called process.exit and this file could not have got this far.
  assert.equal(typeof ingest, 'function');
  assert.ok(DEFAULT_EVIDENCE_DIR.endsWith(path.join('docs', 'audit', 'evidence')));
});

test('KNOWN_GATES mirrors the scorer gate list, not a local copy', async () => {
  const scorer = await import('../tools/90plus-score.mjs');
  assert.deepEqual([...KNOWN_GATES], Object.keys(scorer.GATES).sort());
  assert.equal(KNOWN_GATES.length, 9);
});

test('findCandidates recurses and ignores non-gate json files', () => {
  const from = bundle({
    [`${GATE}.json`]: passDoc(),
    'summary.json': { unrelated: true },
    'run.log': 'not json',
  });
  const found = findCandidates(from);
  assert.equal(found.length, 1);
  assert.equal(found[0].gate, GATE);
});

// ---------------------------------------------------------------- accepted

test('a conforming pass artifact is accepted and copied', () => {
  const from = bundle({ [`${GATE}.json`]: passDoc() });
  const res = run(from);
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /accepted\s+:\s+1/);
  assert.match(res.stdout, /files written\s+:\s+1/);
  assert.match(res.stdout, new RegExp(`${GATE}\\s+ACCEPT`));
  const written = path.join(res.into, `${GATE}.json`);
  assert.ok(fs.existsSync(written), 'accepted artifact was not written');
  assert.equal(JSON.parse(fs.readFileSync(written, 'utf8')).result, 'pass');
});

test('multiple gates in one bundle are each judged independently', () => {
  const from = bundle({
    [`${GATE}.json`]: passDoc(),
    'dr_restore.json': passDoc({ gate: 'dr_restore', result: 'fail' }),
  });
  const res = run(from);
  assert.equal(res.code, 1, 'a rejected artifact must make the run fail');
  assert.match(res.stdout, /accepted\s+:\s+1/);
  assert.match(res.stdout, /rejected\s+:\s+1/);
  assert.ok(fs.existsSync(path.join(res.into, `${GATE}.json`)));
  assert.ok(!fs.existsSync(path.join(res.into, 'dr_restore.json')));
});

// ---------------------------------------------------------------- rejections

const rejections = [
  ['malformed JSON', '{ this is not json', /malformed/],
  ['a JSON array instead of an object', '[]', /malformed/],
  ['result fail', passDoc({ result: 'fail' }), /result is "fail"|not "pass"|result/],
  ['result PASS in the wrong case', passDoc({ result: 'PASS' }), /result/],
  ['an empty logUrl', passDoc({ logUrl: '' }), /untraceable/],
  ['a placeholder logUrl', passDoc({ logUrl: 'https://example.com/log' }), /untraceable/],
  ['a missing ranAt', passDoc({ ranAt: undefined }), /undated|ranAt|timestamp/i],
  ['an unparsable ranAt', passDoc({ ranAt: 'last tuesday' }), /undated|ranAt|timestamp/i],
  [
    'a stale ranAt',
    passDoc({
      ranAt: new Date(Date.now() - (EVIDENCE_MAX_AGE_DAYS + 5) * 86400000).toISOString(),
    }),
    /stale/i,
  ],
  ['a gate name mismatching the filename', passDoc({ gate: 'dr_restore' }), /mismatch|gate/i],
];

for (const [label, content, reasonRe] of rejections) {
  test(`rejects ${label} and writes nothing`, () => {
    const from = bundle({ [`${GATE}.json`]: content });
    const res = run(from);
    assert.equal(res.code, 1, `expected non-zero exit; stdout=${res.stdout}`);
    assert.match(res.stdout, /accepted\s+:\s+0/);
    assert.match(res.stdout, /rejected\s+:\s+1/);
    assert.match(res.stdout, new RegExp(`${GATE}\\s+REJECT`));
    assert.match(res.stderr, /^REJECTED /m, 'rejection must be reported on stderr');
    assert.match(`${res.stdout}\n${res.stderr}`, reasonRe);
    assert.equal(
      fs.existsSync(path.join(res.into, `${GATE}.json`)),
      false,
      'a rejected artifact must never be written',
    );
  });
}

// ---------------------------------------------------------------- dry run

test('--dry-run prints the table and writes nothing', () => {
  const from = bundle({ [`${GATE}.json`]: passDoc() });
  const res = run(from, ['--dry-run']);
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /accepted\s+:\s+1/);
  assert.match(res.stdout, /files written\s+:\s+0 \(dry run\)/);
  assert.match(res.stdout, new RegExp(`${GATE}\\s+ACCEPT`));
  assert.equal(
    fs.existsSync(path.join(res.into, `${GATE}.json`)),
    false,
    '--dry-run must not write any file',
  );
});

test('--dry-run still reports rejections and exits non-zero', () => {
  const from = bundle({ [`${GATE}.json`]: passDoc({ result: 'fail' }) });
  const res = run(from, ['--dry-run']);
  assert.equal(res.code, 1);
  assert.match(res.stdout, /rejected\s+:\s+1/);
});

// ---------------------------------------------------------------- monotonic ranAt

test('an older ranAt does not clobber newer committed evidence', () => {
  const into = tmp('hope-ingest-into-');
  const newer = passDoc({ ranAt: new Date(Date.now() - 60_000).toISOString() });
  fs.writeFileSync(path.join(into, `${GATE}.json`), JSON.stringify(newer, null, 2));

  const older = passDoc({
    ranAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    note: 'older run that must not win',
  });
  const from = bundle({ [`${GATE}.json`]: older });

  const res = ingest({ from, into });
  assert.equal(res.accepted.length, 0);
  assert.equal(res.skipped.length, 1);
  assert.equal(res.skipped[0].status, 'stale-vs-committed');
  assert.equal(res.wrote, 0);

  const onDisk = JSON.parse(fs.readFileSync(path.join(into, `${GATE}.json`), 'utf8'));
  assert.equal(onDisk.ranAt, newer.ranAt, 'committed newer evidence was overwritten by an older run');
  assert.match(formatReport(res, { dryRun: false }), /SKIP/);
});

test('a newer ranAt does replace older committed evidence', () => {
  const into = tmp('hope-ingest-into-');
  const older = passDoc({ ranAt: new Date(Date.now() - 10 * 86400000).toISOString() });
  fs.writeFileSync(path.join(into, `${GATE}.json`), JSON.stringify(older, null, 2));

  const newer = passDoc({ ranAt: new Date().toISOString(), note: 'fresh run' });
  const from = bundle({ [`${GATE}.json`]: newer });

  const res = ingest({ from, into });
  assert.equal(res.accepted.length, 1);
  assert.equal(res.wrote, 1);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(into, `${GATE}.json`), 'utf8')).ranAt,
    newer.ranAt,
  );
});

// ---------------------------------------------------------------- guards

test('a bad --from directory exits 2 without writing', () => {
  const res = run(path.join(os.tmpdir(), 'hope-does-not-exist-s19'));
  assert.equal(res.code, 2);
  assert.match(res.stderr, /not a directory/);
});

test('an empty bundle is a clean no-op, not a false success claim', () => {
  const from = tmp();
  const res = run(from);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /candidates found\s+:\s+0/);
  assert.match(res.stdout, /no <gate>\.json candidates found/);
});
