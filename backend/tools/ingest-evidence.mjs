#!/usr/bin/env node
/**
 * HOPE runtime-evidence ingestion.
 *
 * Purpose
 * -------
 * `backend/tools/write-evidence.mjs` runs INSIDE GitHub Actions and emits
 * `<gate>.json` into an uploaded artifact bundle. Nothing in this repository
 * could previously move those artifacts into `docs/audit/evidence/` — the owner
 * had to copy files by hand, which is exactly the step where a well-meaning
 * human turns a `fail` artifact into a committed "pass".
 *
 * This CLI closes that hole. It walks a directory of CI-downloaded artifacts
 * recursively and copies a file into `docs/audit/evidence/` ONLY when that file
 * already satisfies the runtime-evidence proof predicate — the very same predicate the
 * scorer uses, IMPORTED from `90plus-score.mjs` rather than re-implemented, so
 * the two can never drift apart.
 *
 * Design constraints (deliberate)
 * -------------------------------
 * - The predicate is NOT duplicated here. `evaluateGateEvidence` is imported.
 *   If the scorer's rules tighten, ingestion tightens with it automatically.
 * - Candidates are judged in a throwaway staging directory, so a rejected
 *   artifact never touches `docs/audit/evidence/` even momentarily.
 * - Monotonic `ranAt`: an accepted artifact never replaces a committed artifact
 *   that is NEWER. Re-running an old download cannot roll evidence backwards.
 * - Exit code is non-zero if anything was rejected, so `set -e` notices.
 * - No network I/O. No writes at all under `--dry-run`.
 *
 * Usage
 * -----
 *   node backend/tools/ingest-evidence.mjs --from <dir> [--dry-run] [--into <dir>]
 *
 *   --from <dir>   directory holding unzipped `*-runtime-evidence-*` artifacts
 *                  (searched recursively). Required.
 *   --dry-run      print the accept/reject table and write NOTHING. Default OFF.
 *   --into <dir>   destination, defaults to <repo>/docs/audit/evidence.
 *                  Present for tests; production runs should omit it.
 *
 * Exit codes: 0 = nothing rejected, 1 = at least one candidate rejected,
 *             2 = bad invocation.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GATES, evaluateGateEvidence } from './90plus-score.mjs';

const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const repoRoot = path.resolve(backendRoot, '..');
export const DEFAULT_EVIDENCE_DIR = path.join(repoRoot, 'docs', 'audit', 'evidence');

/** Gate names the scorer actually consumes. Anything else is not evidence. */
export const KNOWN_GATES = Object.freeze(Object.keys(GATES).sort());

export function parseArgs(argv) {
  const args = { from: null, dryRun: false, into: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--from') {
      args.from = argv[i + 1] ?? null;
      i += 1;
    } else if (token === '--into') {
      args.into = argv[i + 1] ?? null;
      i += 1;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  if (args.help) return args;
  if (!args.from) throw new Error('--from <dir> is required');
  return args;
}

/**
 * Recursively collect `<gate>.json` candidates under `dir`.
 * Only filenames matching a gate the scorer knows about are considered; other
 * files in an artifact bundle (logs, summaries) are ignored, not rejected.
 */
export function findCandidates(dir, depth = 0) {
  const found = [];
  if (depth > 12) return found;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findCandidates(full, depth + 1));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const gate = entry.name.slice(0, -'.json'.length);
    if (!KNOWN_GATES.includes(gate)) continue;
    found.push({ gate, file: full });
  }
  return found;
}

function readRanAt(file) {
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const at = Date.parse(doc?.ranAt);
    return Number.isNaN(at) ? null : at;
  } catch {
    return null;
  }
}

/**
 * Judge one candidate against the scorer predicate WITHOUT touching the real
 * evidence directory: the file is staged into a temp dir named `<gate>.json` and
 * `evaluateGateEvidence` is pointed at that temp dir.
 */
function judge(candidate, now) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-ingest-'));
  try {
    const staged = path.join(staging, `${candidate.gate}.json`);
    fs.copyFileSync(candidate.file, staged);
    return evaluateGateEvidence(staging, candidate.gate, now);
  } catch (err) {
    return {
      proven: false,
      status: 'unreadable',
      detail: `candidate cannot be staged (${err.code ?? err.message})`,
    };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * Core. Performs no writes at all when `dryRun` is true.
 * @returns {{accepted:Array,rejected:Array,skipped:Array,wrote:number,candidates:number}}
 */
export function ingest({ from, into = DEFAULT_EVIDENCE_DIR, dryRun = false, now = Date.now() }) {
  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) {
    throw new Error(`--from is not a directory: ${from}`);
  }
  const candidates = findCandidates(from);
  const accepted = [];
  const rejected = [];
  const skipped = [];
  let wrote = 0;

  for (const candidate of candidates) {
    const verdict = judge(candidate, now);
    if (!verdict.proven) {
      rejected.push({ ...candidate, status: verdict.status, reason: verdict.detail });
      continue;
    }
    const incomingRanAt = readRanAt(candidate.file);
    const target = path.join(into, `${candidate.gate}.json`);
    const existingRanAt = fs.existsSync(target) ? readRanAt(target) : null;
    if (existingRanAt !== null && incomingRanAt !== null && incomingRanAt <= existingRanAt) {
      skipped.push({
        ...candidate,
        status: 'stale-vs-committed',
        reason:
          `committed evidence ranAt ${new Date(existingRanAt).toISOString()} is newer than or equal to ` +
          `candidate ranAt ${new Date(incomingRanAt).toISOString()}; refusing to roll evidence backwards`,
      });
      continue;
    }
    accepted.push({
      ...candidate,
      ranAt: incomingRanAt === null ? null : new Date(incomingRanAt).toISOString(),
    });
    if (!dryRun) {
      fs.mkdirSync(into, { recursive: true });
      fs.copyFileSync(candidate.file, target);
      wrote += 1;
    }
  }
  return { accepted, rejected, skipped, wrote, candidates: candidates.length };
}

export function formatReport(result, { dryRun } = {}) {
  const lines = [];
  lines.push(`candidates found : ${result.candidates}`);
  lines.push(`accepted         : ${result.accepted.length}`);
  lines.push(`rejected         : ${result.rejected.length}`);
  lines.push(`skipped (older)  : ${result.skipped.length}`);
  lines.push(`files written    : ${dryRun ? '0 (dry run)' : result.wrote}`);
  lines.push('');
  lines.push('gate                   verdict   detail');
  lines.push('---------------------- --------- ------------------------------------------');
  const row = (gate, verdict, detail) => `${gate.padEnd(22)} ${verdict.padEnd(9)} ${detail}`;
  for (const a of result.accepted) lines.push(row(a.gate, 'ACCEPT', `ranAt=${a.ranAt ?? 'n/a'}`));
  for (const s of result.skipped) lines.push(row(s.gate, 'SKIP', `${s.status}: ${s.reason}`));
  for (const r of result.rejected) lines.push(row(r.gate, 'REJECT', `${r.status}: ${r.reason}`));
  if (!result.candidates) {
    lines.push('(no <gate>.json candidates found under --from)');
  }
  return lines.join('\n');
}

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;

if (isMain) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`ingest-evidence: ${err.message}\n`);
    process.stderr.write(
      'usage: node backend/tools/ingest-evidence.mjs --from <dir> [--dry-run] [--into <dir>]\n',
    );
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(
      [
        'usage: node backend/tools/ingest-evidence.mjs --from <dir> [--dry-run] [--into <dir>]',
        '',
        'Copies CI runtime-evidence artifacts into docs/audit/evidence/ only when they',
        'satisfy the scorer proof predicate (evaluateGateEvidence in 90plus-score.mjs).',
        `Known gates: ${KNOWN_GATES.join(', ')}`,
        '',
        '  --from <dir>  unzipped *-runtime-evidence-* bundle(s), searched recursively',
        '  --dry-run     print the accept/reject table and write nothing',
        '  --into <dir>  destination override (tests only)',
        '',
        'Exit 0 = nothing rejected, 1 = something rejected, 2 = bad invocation.',
        '',
      ].join('\n'),
    );
    process.exit(0);
  }
  let result;
  try {
    result = ingest({ from: args.from, into: args.into ?? DEFAULT_EVIDENCE_DIR, dryRun: args.dryRun });
  } catch (err) {
    process.stderr.write(`ingest-evidence: ${err.message}\n`);
    process.exit(2);
  }
  process.stdout.write(`${formatReport(result, { dryRun: args.dryRun })}\n`);
  for (const r of result.rejected) {
    process.stderr.write(`REJECTED ${r.gate} (${r.file}): ${r.status}: ${r.reason}\n`);
  }
  for (const s of result.skipped) {
    process.stderr.write(`SKIPPED ${s.gate} (${s.file}): ${s.status}: ${s.reason}\n`);
  }
  if (result.rejected.length) {
    process.stderr.write(
      `ingest-evidence: ${result.rejected.length} artifact(s) did not satisfy the proof predicate and were NOT ingested.\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}
