#!/usr/bin/env node
// F3 guard (Session 007).
//
// Background finding F3 (Session 006): running the full legacy-mode offline
// suite with DATABASE_URL set fails ~49/517 tests BY DESIGN. src/db.js
// deliberately disables the in-memory legacy test adapter under a SQL runtime
// (allowLegacyRuntime = isTestRuntime && !isPostgresRuntime; db.collection /
// db.insert / db.reset throw there). The two supported execution modes are:
//   1. Offline legacy suites  -> WITHOUT DATABASE_URL
//   2. npm run test:postgres  -> WITH DATABASE_URL, fresh database only
//
// This guard is WARN-ONLY on purpose: it must never turn a by-design runtime
// failure into a hidden pass, and it must never mask a real misconfiguration
// by failing loudly in its place. It makes the contract visible at invocation
// time (local shells and CI) so the combination is an explicit, informed
// choice instead of a surprise 49-failure run.

const suite = process.argv[2] || 'test:offline';

if (process.env.DATABASE_URL) {
  const warn = (line) => process.stderr.write(`${line}\n`);
  warn(`[hope-guard] WARNING: DATABASE_URL is set while running "${suite}".`);
  warn('[hope-guard] The offline legacy suite is designed to run WITHOUT DATABASE_URL:');
  warn('[hope-guard] src/db.js disables the in-memory test adapter under a SQL runtime');
  warn('[hope-guard] (allowLegacyRuntime = isTestRuntime && !isPostgresRuntime), so most');
  warn('[hope-guard] legacy tests fail in that combination BY DESIGN (finding F3).');
  warn('[hope-guard] Supported modes:');
  warn('[hope-guard]   1) offline suites (test:offline / test:fast / test:contract / test:backup) -> unset DATABASE_URL');
  warn('[hope-guard]   2) npm run test:postgres -> WITH DATABASE_URL, against a FRESH database only');
  warn('[hope-guard] See backend/README.md -> "Test execution modes (two-mode contract)".');
}

process.exit(0);
