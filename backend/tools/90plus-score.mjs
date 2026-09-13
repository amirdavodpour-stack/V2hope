#!/usr/bin/env node
/**
 * HOPE 90+ scorecard — evidence-derived scoring engine.
 *
 * the previous version of this file emitted a hardcoded `scores`
 * object (literal integers per domain). Those numbers were not measurements and
 * could be "improved" by editing the file, which is exactly the fake-green
 * failure mode this program forbids. This version derives every score from
 * checks executed against the repository, plus explicit runtime-evidence gates.
 *
 * Scoring model per domain:
 *   base   = 100 * (sum of weights of passing static checks) / (sum of weights)
 *   score  = min(base, cap) where cap is lowered when a required runtime
 *            evidence file is missing (unproven external gate).
 *
 * Runtime evidence lives in docs/audit/evidence/<gate>.json and must be written
 * by a real run (CI job, staging drill, device certification). Absence is
 * reported honestly as UNPROVEN — it is never assumed to pass.
 */
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const projectRoot = path.resolve(backendRoot, '..');
const evidenceDir = path.join(projectRoot, 'docs', 'audit', 'evidence');

const rel = (...p) => path.join(projectRoot, ...p);
const exists = (...p) => fs.existsSync(rel(...p));
const read = (...p) => {
  try {
    return fs.readFileSync(rel(...p), 'utf8');
  } catch {
    return '';
  }
};
const listFiles = (dir, ext) => {
  const root = rel(dir);
  if (!fs.existsSync(root)) return [];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (!ext || e.name.endsWith(ext)) out.push(full);
    }
  };
  walk(root);
  return out;
};
const anyFileMatches = (dir, ext, re) =>
  listFiles(dir, ext).some((f) => re.test(fs.readFileSync(f, 'utf8')));
const countFiles = (dir, ext) => listFiles(dir, ext).length;

/** Runtime gates: proven only when a real evidence artifact exists. */
// Exported (read-only map, unchanged content) so backend/tools/ingest-evidence.mjs
// can enumerate the gate names the scorer consumes without duplicating the list.
export const GATES = {
  flutter_toolchain: 'flutter analyze/test executed on a real SDK',
  android_build: 'signed APK/AAB produced with checksum',
  device_certification: 'install + critical flow run on device/emulator',
  postgres_runtime: 'PostgreSQL-backed suite executed',
  s3_runtime: 'real object-storage lifecycle executed',
  provider_runtime: 'real payment/notification provider delivery executed',
  dr_restore: 'backup restore / chaos drill executed',
  perf_run: 'performance run on target Node version',
  npm_audit: 'npm audit --audit-level=high executed against the registry',
};

/**
 * Runtime-evidence proof predicate.
 *
 * Previously a gate counted as proven when docs/audit/evidence/<gate>.json
 * merely EXISTED — the file's `result` was never inspected, so committing an
 * evidence file whose result was "fail" would have lifted the domain cap and
 * inflated the score. That was recorded as a Code Bug in S17 and is fixed here.
 *
 * A gate is proven only when its artifact:
 *   - parses as a JSON object,
 *   - has `gate` equal to the filename,
 *   - has `result` exactly the string 'pass' (case-sensitive),
 *   - carries the traceability fields written by backend/tools/write-evidence.mjs:
 *     a `logUrl` that has the shape of a real GitHub Actions run URL and a
 *     parseable `ranAt` ISO timestamp,
 *   - is not older than EVIDENCE_MAX_AGE_DAYS.
 *
 * Anything else — missing file, unreadable file, unparseable JSON, wrong type,
 * result 'fail', absent or non-run-shaped log URL, absent timestamp, stale
 * timestamp — is NOT proof.
 * Malformed evidence never throws: it fails closed (unproven) and is reported
 * in the scorecard's `evidenceIssues` list and on stderr, so a broken artifact
 * is loud instead of silent.
 *
 * Scoring weights, GATE_CAP and gatePenalty are deliberately untouched.
 */
/**
 * logUrl traceability format.
 *
 * Earlier logic only required `logUrl` to be a non-empty string, so a hand-written
 * placeholder such as "see the CI log" or "https://example.com/log" satisfied
 * traceability while pointing at nothing. A run link is only traceable when a
 * human can open it and read the run that produced the artifact, so the value
 * must have the shape of a real GitHub Actions run URL:
 *
 *   https://github.com/<owner>/<repo>/actions/runs/<numeric run id>
 *   ... optionally followed by /job/<numeric id> or /attempts/<n>
 *
 * This is an OFFLINE FORMAT CHECK ONLY. It proves the value is shaped like a run
 * link; it does NOT prove the run exists. Verifying existence would require a
 * GitHub API call and a token policy, which is deliberately DEFERRED (see
 * docs/audit/evidence/README.md) — the scorer performs no network I/O.
 *
 * backend/tools/write-evidence.mjs builds this value from GITHUB_SERVER_URL,
 * GITHUB_REPOSITORY, GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT as
 * `<server>/<repo>/actions/runs/<id>/attempts/<n>`, which satisfies the pattern
 * on github.com. The emitter was verified against this rule, not adjusted to it.
 */
export const LOG_URL_PATTERN =
  /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*\/actions\/runs\/[0-9]+(?:\/job\/[0-9]+|\/attempts\/[0-9]+)?$/;

export const EVIDENCE_MAX_AGE_DAYS = 90;
const EVIDENCE_MAX_AGE_MS = EVIDENCE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export function evaluateGateEvidence(dir, gate, now = Date.now()) {
  const file = path.join(dir, `${gate}.json`);
  const unproven = (status, detail) => ({ proven: false, status, detail });
  if (!fs.existsSync(file)) {
    return unproven('missing', `no artifact at docs/audit/evidence/${gate}.json`);
  }
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return unproven('unreadable', `evidence file cannot be read (${err.code ?? 'read error'})`);
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return unproven('malformed', 'evidence file is not valid JSON');
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return unproven('malformed', 'evidence file is not a JSON object');
  }
  if (doc.gate !== gate) {
    return unproven('mismatched', `evidence gate field is ${JSON.stringify(doc.gate ?? null)}, expected "${gate}"`);
  }
  if (doc.result !== 'pass') {
    const shown = typeof doc.result === 'string' ? `"${doc.result}"` : JSON.stringify(doc.result ?? null);
    return unproven(doc.result === 'fail' ? 'failing' : 'invalid-result', `evidence result is ${shown}, not "pass"`);
  }
  if (typeof doc.logUrl !== 'string' || doc.logUrl.trim() === '') {
    return unproven('untraceable', 'evidence has no logUrl, so the run cannot be traced');
  }
  if (!LOG_URL_PATTERN.test(doc.logUrl.trim())) {
    return unproven(
      'untraceable',
      `evidence logUrl ${JSON.stringify(doc.logUrl)} is not a GitHub Actions run URL ` +
        '(expected https://github.com/<owner>/<repo>/actions/runs/<id>[/job/<id>|/attempts/<n>]), ' +
        'so the run cannot be traced',
    );
  }
  if (typeof doc.ranAt !== 'string' || Number.isNaN(Date.parse(doc.ranAt))) {
    return unproven('untraceable', 'evidence has no parseable ranAt timestamp');
  }
  const ageMs = now - Date.parse(doc.ranAt);
  if (ageMs > EVIDENCE_MAX_AGE_MS) {
    const days = Math.floor(ageMs / 86400000);
    return unproven('stale', `evidence ran ${days} days ago, older than the ${EVIDENCE_MAX_AGE_DAYS}-day window`);
  }
  return { proven: true, status: 'proven', detail: `result=pass ranAt=${doc.ranAt} logUrl=${doc.logUrl}` };
}

const pkg = JSON.parse(read('backend', 'package.json') || '{}');
const pubspec = read('pubspec.yaml');
const workflows = listFiles('.github/workflows', '.yml').map((f) => fs.readFileSync(f, 'utf8'));
const backendSrc = 'backend/src';
const backendTests = 'backend/tests';

const domains = [
  {
    key: 'architecture',
    checks: [
      ['layered backend src tree', () => exists('backend', 'src', 'app.js') && exists('backend', 'src', 'db.js'), 2],
      ['flutter core/features split', () => exists('lib', 'core') && exists('lib', 'features'), 2],
      ['architecture contract test', () => exists('backend', 'tests', 'architecture-contract.test.mjs'), 2],
      ['architecture docs', () => exists('docs', 'architecture'), 1],
    ],
  },
  {
    key: 'backend_api',
    checks: [
      ['openapi spec present', () => exists('backend', 'openapi'), 2],
      ['route contract test', () => exists('backend', 'tests', 'route-contract.mjs'), 2],
      ['health endpoint', () => anyFileMatches(backendSrc, '.js', /\/health/), 1],
      ['input validation layer', () => anyFileMatches(backendSrc, '.js', /validate|schema/i), 1],
    ],
  },
  {
    key: 'database_integrity',
    checks: [
      ['migration runner', () => exists('backend', 'src', 'migrate.js'), 2],
      ['relational schema test', () => exists('backend', 'tests', 'relational-schema.test.mjs'), 2],
      ['database docs', () => exists('docs', 'database'), 1],
    ],
    gates: ['postgres_runtime'],
  },
  {
    key: 'security',
    checks: [
      ['security hardening tests', () => exists('backend', 'tests', 'security-hardening.test.mjs'), 2],
      ['security runtime tests', () => exists('backend', 'tests', 'security-runtime.test.mjs'), 2],
      ['threat model documented', () => exists('SECURITY-THREAT-MODEL.md'), 1],
      ['no plaintext secret assignment in source', () =>
        !anyFileMatches(backendSrc, '.js', /(api_key|secret|password|token)\s*=\s*['"][A-Za-z0-9_\-]{16,}['"]/i), 3],
      ['sbom generated', () => exists('backend', 'sbom.json'), 1],
    ],
    gates: ['npm_audit'],
  },
  {
    key: 'authentication_authorization',
    checks: [
      ['authorization matrix documented', () => exists('AUTHORIZATION-MATRIX.md'), 1],
      ['auth module in app', () => exists('lib', 'core', 'auth') && exists('lib', 'features', 'auth'), 2],
      ['secure storage test', () => exists('test', 'core', 'storage', 'secure_store_test.dart'), 1],
      ['backend auth guard', () => anyFileMatches(backendSrc, '.js', /authoriz|requireRole|auth/i), 2],
    ],
  },
  {
    key: 'payments_financial_integrity',
    checks: [
      ['transactions feature', () => exists('lib', 'features', 'transactions'), 1],
      ['payment provider contract test', () => exists('backend', 'tests', 'security-provider-contract.test.mjs'), 2],
      ['transaction error contract test', () => exists('test', 'core', 'transactions', 'transaction_error_contract_test.dart'), 1],
    ],
    gates: ['provider_runtime'],
  },
  {
    key: 'storage',
    checks: [
      ['storage intent contract test', () => exists('backend', 'tests', 'storage-intent-contract.test.mjs'), 2],
      ['upload surface in app', () => exists('lib', 'core', 'uploads'), 1],
      ['s3 integration script', () => exists('tools', 'ci-s3-integration.sh'), 1],
    ],
    gates: ['s3_runtime'],
  },
  {
    key: 'notifications_outbox',
    checks: [
      ['outbox contract test', () => exists('backend', 'tests', 'outbox-contract.test.mjs'), 2],
      ['notification contract test', () => exists('backend', 'tests', 'notification-contract.test.mjs'), 2],
      ['notifications surface in app', () => exists('lib', 'features', 'notifications'), 1],
    ],
    gates: ['provider_runtime'],
  },
  {
    key: 'privacy',
    checks: [
      ['privacy/permission handling in app', () => anyFileMatches('lib', '.dart', /permission/i), 2],
      ['PII redaction module', () => exists('backend', 'src', 'privacy.js'), 2],
      ['privacy/redaction contract test', () => anyFileMatches(backendTests, '.mjs', /pii|redact|sanitiz/i), 2],
    ],
  },
  {
    key: 'observability',
    checks: [
      ['observability module', () => exists('backend', 'src', 'observability.js'), 2],
      ['tracing/alerts test', () => exists('backend', 'tests', 'wave11-tracing-alerts.test.mjs'), 2],
      ['telemetry in app', () => exists('lib', 'core', 'telemetry'), 1],
    ],
  },
  {
    key: 'mobile_flutter',
    checks: [
      ['pubspec present with version', () => /^version:\s*\d+\.\d+\.\d+/m.test(pubspec), 1],
      ['pubspec.lock committed', () => exists('pubspec.lock'), 1],
      ['analysis_options with lints', () => /include:\s*package:/.test(read('analysis_options.yaml')), 1],
      ['router layer', () => exists('lib', 'core', 'router'), 1],
      ['widget/unit tests present (>=8)', () => countFiles('test', '.dart') >= 8, 2],
      ['integration test present', () => countFiles('integration_test', '.dart') >= 1, 1],
      ['no machine-local android/local.properties', () => !exists('android', 'local.properties'), 1],
      ['release build script', () => exists('tools', 'build_apk_release.sh'), 1],
      ['device certification contract test', () => exists('backend', 'tests', 'device-certification-contract.test.mjs'), 1],
    ],
    gates: ['flutter_toolchain', 'android_build', 'device_certification'],
  },
  {
    key: 'ux',
    checks: [
      ['shared UI components', () => exists('lib', 'core', 'ui'), 1],
      ['ui component tests', () => exists('test', 'core', 'ui', 'ui_components_test.dart'), 1],
      ['empty/loading/error states referenced', () => anyFileMatches('lib', '.dart', /empty|loading|error/i), 2],
      ['ux audit script', () => exists('tools', 'check_ux_wave8.sh'), 1],
    ],
  },
  {
    key: 'accessibility',
    checks: [
      ['accessibility/RTL contract test (backend)', () => exists('backend', 'tests', 'accessibility-rtl-contract.test.mjs'), 2],
      ['accessibility contract test (flutter)', () => exists('test', 'core', 'ui', 'localization_accessibility_contract_test.dart'), 2],
      ['semantics usage in widgets', () => anyFileMatches('lib', '.dart', /Semantics\(|semanticLabel/), 2],
    ],
  },
  {
    key: 'localization',
    checks: [
      ['l10n config', () => exists('l10n.yaml'), 1],
      ['arb resources', () => countFiles('lib/l10n', '.arb') >= 2, 2],
      ['localization check script', () => exists('tools', 'check_localization.sh'), 1],
      ['RTL handling', () => anyFileMatches('lib', '.dart', /TextDirection|Directionality/), 2],
    ],
  },
  {
    key: 'testing',
    checks: [
      ['backend test suite >= 50 files', () => countFiles(backendTests, '.mjs') >= 50, 3],
      ['fast suite script', () => typeof pkg.scripts?.['test:fast'] === 'string', 1],
      ['regression suite script', () => typeof pkg.scripts?.['test:contract'] === 'string', 1],
      ['flutter tests', () => countFiles('test', '.dart') >= 8, 2],
    ],
  },
  {
    key: 'performance',
    checks: [
      ['perf smoke tool', () => exists('backend', 'tools', 'perf-smoke.mjs'), 2],
      ['load smoke test', () => exists('backend', 'tests', 'load-smoke.test.mjs'), 1],
      ['query profiling doc', () => exists('docs', 'QUERY-PROFILING.md'), 1],
    ],
    gates: ['perf_run'],
  },
  {
    key: 'ci_cd',
    checks: [
      ['workflows present (>=4)', () => workflows.length >= 4, 2],
      ['actions pinned to full SHA', () =>
        workflows.length > 0 &&
        workflows.every((w) =>
          (w.match(/uses:\s*[\w.\-]+\/[^\s@]+@([^\s]+)/g) || []).every((u) => /@[0-9a-f]{40}$/.test(u.trim())),
        ), 3],
      ['release workflow', () => workflows.some((w) => /release/i.test(w)), 1],
      ['node engine pinned', () => typeof pkg.engines?.node === 'string', 1],
    ],
  },
  {
    key: 'disaster_recovery_resilience',
    checks: [
      ['DR documentation', () => exists('DISASTER-RECOVERY.md'), 1],
      ['backup contract test', () => exists('backend', 'tests', 'backup-contract.test.mjs'), 2],
      ['resilience contract test', () => exists('backend', 'tests', 'resilience-contract.test.mjs'), 2],
      ['dr-restore workflow', () => workflows.some((w) => /restore|backup/i.test(w)), 1],
    ],
    gates: ['dr_restore'],
  },
  {
    key: 'maintainability',
    checks: [
      ['contributing guide', () => exists('CONTRIBUTING.md'), 1],
      ['changelog maintained', () => exists('CHANGELOG.md'), 1],
      ['syntax check script', () => typeof pkg.scripts?.check === 'string', 1],
      ['release checklist', () => exists('RELEASE-CHECKLIST.md'), 1],
    ],
  },
  {
    key: 'production_readiness',
    checks: [
      ['production env contract test', () => exists('backend', 'tests', 'production-env-contract.test.mjs'), 2],
      ['release manifest tool', () => exists('backend', 'tools', 'release_manifest.mjs'), 1],
      ['release evidence tool', () => exists('tools', 'release_evidence.mjs'), 1],
      ['version alignment pubspec/backend', () => {
        const pv = (pubspec.match(/^version:\s*(\d+\.\d+\.\d+)/m) || [])[1];
        return Boolean(pv && pkg.version && pv === pkg.version);
      }, 2],
      ['dockerfile for backend', () => exists('backend', 'Dockerfile'), 1],
    ],
    gates: ['android_build', 'device_certification', 'postgres_runtime', 'dr_restore', 'npm_audit'],
  },
];

/** Each missing runtime gate caps a domain score. */
const GATE_CAP = 85;
const gatePenalty = 4;

/**
 * Compute the whole scorecard.
 *
 * `evidenceDir` is injectable for one reason only: backend/tests/scorecard-integrity.test.mjs
 * must be able to exercise the proof predicate against fixture artifacts in a
 * temporary directory, because writing a fabricated file into
 * docs/audit/evidence/ would itself be a fake-green violation. Every production
 * caller uses the default (the real evidence directory).
 */
export function computeScorecard({ evidenceDir: dir = evidenceDir, now = Date.now() } = {}) {
  const proofs = Object.fromEntries(
    Object.keys(GATES).map((gate) => [gate, evaluateGateEvidence(dir, gate, now)]),
  );

  const scores = {};
  const details = {};

  for (const domain of domains) {
    let total = 0;
    let passed = 0;
    const checkResults = [];
    for (const [name, fn, weight] of domain.checks) {
      let ok = false;
      try {
        ok = Boolean(fn());
      } catch {
        ok = false;
      }
      total += weight;
      if (ok) passed += weight;
      checkResults.push({ check: name, weight, pass: ok });
    }
    const base = total === 0 ? 0 : (100 * passed) / total;
    const missingGates = (domain.gates || []).filter((g) => !proofs[g].proven);
    let score = base;
    if (missingGates.length > 0) {
      score = Math.min(score, GATE_CAP - gatePenalty * (missingGates.length - 1));
    }
    score = Math.max(0, Math.round(score));
    scores[domain.key] = score;
    details[domain.key] = {
      score,
      staticBase: Math.round(base),
      weightPassed: passed,
      weightTotal: total,
      failedChecks: checkResults.filter((c) => !c.pass).map((c) => c.check),
      missingRuntimeGates: missingGates.map((g) => ({
        gate: g,
        requires: GATES[g],
        reason: proofs[g].detail,
      })),
    };
  }

  const evidence = Object.fromEntries(
    Object.entries(GATES).map(([gate, desc]) => [
      gate,
      proofs[gate].proven
        ? `PROVEN: docs/audit/evidence/${gate}.json — ${proofs[gate].detail}`
        : `UNPROVEN: ${desc} — ${proofs[gate].detail}`,
    ]),
  );

  /** Artifacts that exist but do not prove their gate. Reported loudly, never ignored. */
  const evidenceIssues = Object.entries(proofs)
    .filter(([, p]) => !p.proven && p.status !== 'missing')
    .map(([gate, p]) => ({ gate, status: p.status, detail: p.detail }));

  const blockers = Object.entries(details)
    .filter(([, d]) => d.score < 90)
    .map(([key, d]) => [
      key,
      d.failedChecks.length
        ? `failing static checks: ${d.failedChecks.join('; ')}`
        : `capped by unproven runtime gates: ${d.missingRuntimeGates.map((g) => g.gate).join(', ')}`,
    ]);

  const minScore = Math.min(...Object.values(scores));
  const allAtLeast90 = Object.values(scores).every((v) => v >= 90);

  return {
    generatedAt: new Date().toISOString(),
    engine: 'evidence-derived-v2',
    threshold: 90,
    evidenceMaxAgeDays: EVIDENCE_MAX_AGE_DAYS,
    scores,
    minScore,
    allAtLeast90,
    overallReadiness: Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length,
    ),
    details,
    evidence,
    evidenceIssues,
    blockers,
  };
}

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;

if (isMain) {
  const card = computeScorecard();
  const out = path.join(projectRoot, 'docs', 'audit', '90PLUS-SCORECARD.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(card, null, 2)}\n`);

  for (const issue of card.evidenceIssues) {
    console.error(`evidence rejected: ${issue.gate} (${issue.status}) — ${issue.detail}`);
  }

  console.log(
    JSON.stringify(
      {
        engine: card.engine,
        minScore: card.minScore,
        allAtLeast90: card.allAtLeast90,
        overallReadiness: card.overallReadiness,
        rejectedEvidence: card.evidenceIssues,
        below90: Object.entries(card.scores).filter(([, v]) => v < 90),
      },
      null,
      2,
    ),
  );
  process.exit(card.allAtLeast90 ? 0 : 2);
}
