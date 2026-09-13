import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  EVIDENCE_MAX_AGE_DAYS,
  computeScorecard,
  evaluateGateEvidence,
} from '../tools/90plus-score.mjs';

const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const projectRoot = path.resolve(backendRoot, '..');
const toolPath = path.join(backendRoot, 'tools', '90plus-score.mjs');
const cardPath = path.join(projectRoot, 'docs', 'audit', '90PLUS-SCORECARD.json');

function runScorer() {
  try {
    execFileSync(process.execPath, [toolPath], { cwd: backendRoot, stdio: 'pipe' });
  } catch (err) {
    // exit code 2 means "not all domains >= 90"; that is a valid measurement.
    if (err.status !== 2) throw err;
  }
  return JSON.parse(fs.readFileSync(cardPath, 'utf8'));
}

test('scorecard is produced by the evidence-derived engine', () => {
  const card = runScorer();
  assert.equal(card.engine, 'evidence-derived-v2');
  assert.ok(Object.keys(card.scores).length >= 15);
});

test('scorecard source contains no hardcoded per-domain score literals', () => {
  const src = fs.readFileSync(toolPath, 'utf8');
  const literalScoreMap = /\b(mobile_flutter|production_readiness|security)\s*:\s*\d{2,3}\s*,/;
  assert.equal(literalScoreMap.test(src), false, 'domain scores must be computed, never literals');
});

test('every domain score is backed by check details', () => {
  const card = runScorer();
  for (const [domain, score] of Object.entries(card.scores)) {
    const detail = card.details[domain];
    assert.ok(detail, `missing details for ${domain}`);
    assert.equal(detail.score, score);
    assert.ok(detail.weightTotal > 0, `${domain} has no checks`);
    if (score < 100) {
      assert.ok(
        detail.failedChecks.length > 0 || detail.missingRuntimeGates.length > 0,
        `${domain} scored below 100 without a recorded reason`,
      );
    }
  }
});

test('unproven runtime gates are never reported as proven', () => {
  const card = runScorer();
  const evidenceDir = path.join(projectRoot, 'docs', 'audit', 'evidence');
  for (const [gate, text] of Object.entries(card.evidence)) {
    const hasArtifact = fs.existsSync(path.join(evidenceDir, `${gate}.json`));
    if (!hasArtifact) {
      assert.equal(text.startsWith('PROVEN'), false, `gate ${gate} misreports evidence`);
      continue;
    }
    // Existence alone is not proof. PROVEN must track the proof predicate.
    const proof = evaluateGateEvidence(evidenceDir, gate);
    assert.equal(text.startsWith('PROVEN'), proof.proven, `gate ${gate} misreports evidence`);
  }
});

test('scoring is deterministic for an unchanged tree', () => {
  const a = runScorer();
  const b = runScorer();
  assert.deepEqual(a.scores, b.scores);
});

// ---------------------------------------------------------------------------
// gateProven() hardening.
//
// Fixtures live in a temporary directory, never in docs/audit/evidence/:
// writing a fabricated artifact into the real evidence directory would be a
// fake-green violation even inside a test. computeScorecard() therefore takes
// an injectable evidenceDir for test use only.
// ---------------------------------------------------------------------------

const PASS_EVIDENCE = {
  gate: 'postgres_runtime',
  ranAt: new Date().toISOString(),
  environment: 'github-actions/ubuntu-24.04',
  commit: 'b'.repeat(40),
  command: 'npm run test:postgres',
  result: 'pass',
  artifacts: [],
  logUrl: 'https://github.com/hope/hope/actions/runs/456/attempts/1',
};

function withFixture(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-gate-'));
  try {
    for (const [name, body] of Object.entries(contents)) {
      fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Failing evidence does not prove its gate', () => {
  withFixture({ 'postgres_runtime.json': { ...PASS_EVIDENCE, result: 'fail' } }, (dir) => {
    const proof = evaluateGateEvidence(dir, 'postgres_runtime');
    assert.equal(proof.proven, false, 'a failing run must never prove a gate');
    assert.equal(proof.status, 'failing');

    const card = computeScorecard({ evidenceDir: dir });
    assert.match(card.evidence.postgres_runtime, /^UNPROVEN/);
    assert.ok(
      card.details.database_integrity.missingRuntimeGates.some((g) => g.gate === 'postgres_runtime'),
      'the domain must stay capped by the unproven gate',
    );
    assert.ok(card.details.database_integrity.score <= 85, 'failing evidence must not lift the cap');
    assert.ok(
      card.evidenceIssues.some((i) => i.gate === 'postgres_runtime' && i.status === 'failing'),
      'a rejected artifact must be reported, not silently ignored',
    );
  });
});

test('Malformed evidence does not prove a gate and does not throw', () => {
  withFixture({ 'postgres_runtime.json': '{ this is not json' }, (dir) => {
    let proof;
    assert.doesNotThrow(() => {
      proof = evaluateGateEvidence(dir, 'postgres_runtime');
    });
    assert.equal(proof.proven, false);
    assert.equal(proof.status, 'malformed');

    let card;
    assert.doesNotThrow(() => {
      card = computeScorecard({ evidenceDir: dir });
    }, 'a malformed artifact must not crash the scorer');
    assert.match(card.evidence.postgres_runtime, /^UNPROVEN/);
    assert.ok(card.evidenceIssues.some((i) => i.gate === 'postgres_runtime' && i.status === 'malformed'));
  });

  // A JSON document that parses but is not an object is equally not proof.
  withFixture({ 's3_runtime.json': '"pass"' }, (dir) => {
    const proof = evaluateGateEvidence(dir, 's3_runtime');
    assert.equal(proof.proven, false);
    assert.equal(proof.status, 'malformed');
  });
});

test('Valid passing evidence proves its gate and lifts the cap', () => {
  const cappedCard = computeScorecard({ evidenceDir: path.join(os.tmpdir(), 'hope-gate-absent-dir') });
  assert.ok(cappedCard.details.database_integrity.score <= 85, 'baseline domain must be capped while unproven');

  withFixture({ 'postgres_runtime.json': PASS_EVIDENCE }, (dir) => {
    const proof = evaluateGateEvidence(dir, 'postgres_runtime');
    assert.equal(proof.proven, true);
    assert.equal(proof.status, 'proven');

    const card = computeScorecard({ evidenceDir: dir });
    assert.match(card.evidence.postgres_runtime, /^PROVEN/);
    assert.deepEqual(card.details.database_integrity.missingRuntimeGates, []);
    assert.ok(
      card.details.database_integrity.score > cappedCard.details.database_integrity.score,
      'passing evidence must lift the gate cap',
    );
    assert.deepEqual(card.evidenceIssues, []);
  });
});

test('Evidence missing the run link or timestamp does not prove a gate', () => {
  const cases = [
    ['logUrl', (doc) => { delete doc.logUrl; }],
    ['logUrl empty', (doc) => { doc.logUrl = '   '; }],
    ['logUrl wrong type', (doc) => { doc.logUrl = 42; }],
    ['ranAt', (doc) => { delete doc.ranAt; }],
    ['ranAt unparseable', (doc) => { doc.ranAt = 'yesterday-ish'; }],
  ];
  for (const [label, mutate] of cases) {
    const doc = JSON.parse(JSON.stringify(PASS_EVIDENCE));
    mutate(doc);
    withFixture({ 'postgres_runtime.json': doc }, (dir) => {
      const proof = evaluateGateEvidence(dir, 'postgres_runtime');
      assert.equal(proof.proven, false, `missing ${label} must not prove the gate`);
      assert.equal(proof.status, 'untraceable');
      const card = computeScorecard({ evidenceDir: dir });
      assert.ok(card.details.database_integrity.missingRuntimeGates.some((g) => g.gate === 'postgres_runtime'));
    });
  }
});

test('S18: an artifact whose gate field does not match its filename is rejected', () => {
  withFixture({ 'postgres_runtime.json': { ...PASS_EVIDENCE, gate: 's3_runtime' } }, (dir) => {
    const proof = evaluateGateEvidence(dir, 'postgres_runtime');
    assert.equal(proof.proven, false);
    assert.equal(proof.status, 'mismatched');
  });
});

test('S18: evidence older than the documented freshness window is stale, not proof', () => {
  const stale = {
    ...PASS_EVIDENCE,
    ranAt: new Date(Date.now() - (EVIDENCE_MAX_AGE_DAYS + 1) * 86400000).toISOString(),
  };
  withFixture({ 'postgres_runtime.json': stale }, (dir) => {
    const proof = evaluateGateEvidence(dir, 'postgres_runtime');
    assert.equal(proof.proven, false);
    assert.equal(proof.status, 'stale');
  });
  const fresh = { ...PASS_EVIDENCE, ranAt: new Date(Date.now() - 86400000).toISOString() };
  withFixture({ 'postgres_runtime.json': fresh }, (dir) => {
    assert.equal(evaluateGateEvidence(dir, 'postgres_runtime').proven, true);
  });
});

test('S18: the real evidence directory holds no hand-made artifact', () => {
  const dir = path.join(projectRoot, 'docs', 'audit', 'evidence');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const gate = file.replace(/\.json$/, '');
    const proof = evaluateGateEvidence(dir, gate);
    assert.ok(
      proof.proven || proof.status !== 'malformed',
      `docs/audit/evidence/${file} is malformed; evidence must come from write-evidence.mjs`,
    );
  }
});

// ---------------------------------------------------------------------------
// S19 — logUrl traceability format (owner-approved).
//
// S18 accepted ANY non-empty logUrl, so "https://example.com/log" or a prose
// note satisfied traceability while pointing at nothing openable. S19 requires
// the value to have the shape of a real GitHub Actions run URL. This is an
// OFFLINE FORMAT CHECK ONLY — it proves the value is shaped like a run link, not
// that the run exists (API verification is deliberately deferred: the scorer
// performs no network I/O).

test('S19: a well-formed GitHub Actions run URL satisfies traceability', () => {
  const accepted = [
    'https://github.com/hope/hope/actions/runs/456',
    'https://github.com/hope/hope/actions/runs/456/attempts/1',
    'https://github.com/hope/hope/actions/runs/17203481920/attempts/3',
    'https://github.com/hope/hope/actions/runs/456/job/1234567890',
    'https://github.com/some-org/some.repo_name/actions/runs/1',
  ];
  for (const logUrl of accepted) {
    withFixture({ 'postgres_runtime.json': { ...PASS_EVIDENCE, logUrl } }, (dir) => {
      const proof = evaluateGateEvidence(dir, 'postgres_runtime');
      assert.equal(proof.proven, true, `expected ${logUrl} to be accepted: ${proof.detail}`);
      assert.equal(proof.status, 'proven');
    });
  }
});

test('S19: a logUrl that is not a GitHub Actions run URL is rejected as untraceable', () => {
  const rejected = [
    // plain http, not https
    'http://github.com/hope/hope/actions/runs/456',
    // not github.com — a lookalike host cannot be trusted as the run link
    'https://github.example.com/hope/hope/actions/runs/456',
    'https://gitlab.com/hope/hope/actions/runs/456',
    'https://notgithub.com/hope/hope/actions/runs/456',
    // github.com but not an /actions/runs/ path
    'https://github.com/hope/hope',
    'https://github.com/hope/hope/actions',
    'https://github.com/hope/hope/actions/workflows/main.yml',
    'https://github.com/hope/hope/commit/abc123',
    // non-numeric run id
    'https://github.com/hope/hope/actions/runs/latest',
    'https://github.com/hope/hope/actions/runs/456x',
    'https://github.com/hope/hope/actions/runs/',
    // non-numeric job / attempt suffix
    'https://github.com/hope/hope/actions/runs/456/attempts/latest',
    'https://github.com/hope/hope/actions/runs/456/job/abc',
    // the classic hand-written placeholders
    'https://example.com/log',
    'see the CI log',
    'TBD',
  ];
  for (const logUrl of rejected) {
    withFixture({ 'postgres_runtime.json': { ...PASS_EVIDENCE, logUrl } }, (dir) => {
      const proof = evaluateGateEvidence(dir, 'postgres_runtime');
      assert.equal(proof.proven, false, `expected ${logUrl} to be rejected`);
      assert.equal(proof.status, 'untraceable', `wrong status for ${logUrl}: ${proof.status}`);
      assert.match(
        proof.detail,
        /cannot be traced/,
        `rejection reason must name traceability for ${logUrl}`,
      );
    });
  }
});

test('S19: an untraceable logUrl fails closed — no crash, and the gate stays capped', () => {
  withFixture(
    { 'postgres_runtime.json': { ...PASS_EVIDENCE, logUrl: 'https://example.com/log' } },
    (dir) => {
      const card = computeScorecard({ evidenceDir: dir });
      assert.match(card.evidence.postgres_runtime, /^UNPROVEN:/);
      assert.match(card.evidence.postgres_runtime, /cannot be traced/);
      const issue = card.evidenceIssues.find((i) => i.gate === 'postgres_runtime');
      assert.ok(issue, 'an untraceable artifact must be surfaced in evidenceIssues');
      assert.equal(issue.status, 'untraceable');
      assert.match(issue.detail, /GitHub Actions run URL/);
      // the placeholder must not have lifted any cap
      const capped = Object.values(card.details).filter((d) =>
        (d.missingRuntimeGates ?? []).some((g) => g.gate === 'postgres_runtime'),
      );
      assert.ok(capped.length > 0, 'the placeholder logUrl must not have lifted any domain cap');
      for (const d of capped) assert.ok(d.score <= 85, 'a capped domain must stay at or below GATE_CAP');
    },
  );
});

test('S19: write-evidence.mjs emits a logUrl that satisfies the scorer rule', async () => {
  // The rule must be satisfied by the real emitter, not the other way round.
  const { buildEvidence } = await import('../tools/write-evidence.mjs');
  const { LOG_URL_PATTERN } = await import('../tools/90plus-score.mjs');
  const doc = buildEvidence(
    {
      gate: 'postgres_runtime',
      result: 'pass',
      note: 'ci',
      artifacts: [],
      command: 'npm run test:postgres',
    },
    {
      CI: 'true',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'hope/hope',
      GITHUB_RUN_ID: '17203481920',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_SHA: 'c'.repeat(40),
      GITHUB_WORKFLOW: 'HOPE Staging Certification',
      RUNNER_OS: 'Linux',
      ImageOS: 'ubuntu24',
    },
  );
  assert.match(
    doc.logUrl,
    LOG_URL_PATTERN,
    `write-evidence emitted a logUrl the scorer would reject: ${doc.logUrl}`,
  );
});
