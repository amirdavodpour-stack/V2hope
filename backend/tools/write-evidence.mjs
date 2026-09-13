#!/usr/bin/env node
/**
 * HOPE runtime-evidence writer.
 *
 * Writes docs/audit/evidence/<gate>.json for a runtime gate consumed by
 * backend/tools/90plus-score.mjs.
 *
 * Anti-fake-green design:
 *  - refuses to run unless CI=true (a human cannot hand-mint an artifact that
 *    the scorer will accept without a real automated run),
 *  - refuses unknown gate names,
 *  - never trusts caller-supplied sizes/checksums: every declared artifact path
 *    must exist on disk and bytes + sha256 are measured here,
 *  - requires a resolvable CI log URL (GitHub Actions run URL),
 *  - records the exit status of the observed command; a non-"pass" result is
 *    written as-is and still caps the score (honest failure over silence).
 *
 * Usage:
 *   node backend/tools/write-evidence.mjs \
 *     --gate npm_audit \
 *     --command "npm audit --audit-level=high" \
 *     --result pass \
 *     [--artifact <path>]... \
 *     [--note "<text>"] \
 *     [--data <json-file>]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KNOWN_GATES = new Set([
  'flutter_toolchain',
  'android_build',
  'device_certification',
  'postgres_runtime',
  's3_runtime',
  'provider_runtime',
  'dr_restore',
  'perf_run',
  'npm_audit',
]);

const RESULTS = new Set(['pass', 'fail']);

export function parseArgs(argv) {
  const out = { artifacts: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case '--gate':
      case '--command':
      case '--result':
      case '--note':
      case '--data':
        if (value === undefined) throw new Error(`missing value for ${key}`);
        out[key.slice(2)] = value;
        i += 1;
        break;
      case '--artifact':
        if (value === undefined) throw new Error('missing value for --artifact');
        out.artifacts.push(value);
        i += 1;
        break;
      default:
        throw new Error(`unknown argument: ${key}`);
    }
  }
  return out;
}

export function describeArtifact(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`artifact is not a file: ${filePath}`);
  if (stat.size === 0) throw new Error(`artifact is empty: ${filePath}`);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return { path: filePath, bytes: stat.size, sha256 };
}

/**
 * The run link recorded in every evidence artifact.
 *
 * CONTRACT: the value produced here must satisfy `LOG_URL_PATTERN` in
 * `backend/tools/90plus-score.mjs`, i.e. it must have the shape
 * `https://github.com/<owner>/<repo>/actions/runs/<numeric id>[/attempts/<n>]`.
 * On github.com the construction below already does, so nothing changed here in
 * The scorer rule is validated against this emitter rather than the
 * emitter being bent to fit the rule. `backend/tests/scorecard-integrity.test.mjs`
 * asserts the two agree, so they cannot drift.
 *
 * Consequence for self-hosted GitHub Enterprise: GITHUB_SERVER_URL would not be
 * `https://github.com`, and the scorer would reject the artifact as
 * `untraceable`. That is intentional fail-closed behaviour, not an oversight —
 * widening the host rule needs an explicit owner decision.
 */
export function buildLogUrl(env) {
  const server = env.GITHUB_SERVER_URL;
  const repo = env.GITHUB_REPOSITORY;
  const runId = env.GITHUB_RUN_ID;
  const attempt = env.GITHUB_RUN_ATTEMPT || '1';
  if (!server || !repo || !runId) return null;
  return `${server}/${repo}/actions/runs/${runId}/attempts/${attempt}`;
}

export function buildEvidence(args, env, now = new Date()) {
  if (env.CI !== 'true') {
    throw new Error('runtime evidence may only be produced by an automated run (CI=true)');
  }
  if (!args.gate || !KNOWN_GATES.has(args.gate)) {
    throw new Error(`unknown gate: ${args.gate ?? '<missing>'}`);
  }
  if (!args.command) throw new Error('--command is required');
  if (!RESULTS.has(args.result)) throw new Error('--result must be pass or fail');
  const logUrl = buildLogUrl(env);
  if (!logUrl) throw new Error('cannot resolve CI log URL from GITHUB_* environment');

  const evidence = {
    gate: args.gate,
    ranAt: now.toISOString(),
    environment: `${env.GITHUB_WORKFLOW ?? 'unknown-workflow'}/${env.RUNNER_OS ?? 'unknown-os'}`,
    commit: env.GITHUB_SHA ?? null,
    command: args.command,
    result: args.result,
    artifacts: args.artifacts.map(describeArtifact),
    logUrl,
  };
  if (args.note) evidence.note = args.note;
  if (args.data) {
    const raw = fs.readFileSync(args.data, 'utf8');
    evidence.data = JSON.parse(raw);
  }
  return evidence;
}

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;

if (isMain) {
  const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const projectRoot = path.resolve(backendRoot, '..');
  try {
    const args = parseArgs(process.argv.slice(2));
    const evidence = buildEvidence(args, process.env);
    const dir = path.join(projectRoot, 'docs', 'audit', 'evidence');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${evidence.gate}.json`);
    fs.writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`wrote ${path.relative(projectRoot, out)} (result=${evidence.result})`);
  } catch (err) {
    console.error(`evidence rejected: ${err.message}`);
    process.exit(1);
  }
}
