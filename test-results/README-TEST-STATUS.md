# HOPE-V7 - Test Status (READ ME FIRST)

**Latest verification layer:** `prebuild-qual-20260913T021809Z` (2026-09-13) - pre-build qualification session.

**Current status:** Backend suites green; backend coverage gate PASS at 81.22% line / 70.65% branch / 74.02% functions (gate 70/60/65). Flutter suite 388/388 tests passed; line coverage 57.45% < 65% (threshold only, no gate weakening). PostgreSQL isolation deterministic (3x 4/4, 0 leftover DBs). Performance verified as rate-limit policy behavior (0x5xx, p95 well under budget). Runtime certification blocked by unavailable Android SDK/ADB/emulator, Docker, S3, deployed staging and the 6144 MiB certified-runner requirement.

## Current Verification

| Domain | Result |
|---|---|
| Backend | umbrella 522 pass / 0 fail / 4 skipped of 526; fast 217/217 PASS; contract PASS; security audit 0 vulns; production-env/sbom/manifest PASS |
| Backend coverage | **81.22 / 70.65 / 74.02 PASS** (gate 70/60/65) |
| Flutter | **388/388 PASS**; analyze **0 issues** |
| Flutter coverage | **57.45% < 65% FAIL (threshold only)** |
| PostgreSQL isolation | 3x 4/4 PASS; 0 leftover DBs |
| DR restore drill | PASS (real pg_dump + pg_restore, disposable DBs) |
| Performance | rate-limit policy limit; 0x5xx; p95 within budget |
| Runtime certification | **BLOCKED** (Android/Docker/S3/staging/6144 MiB runner) |
| Final build | **NOT PERFORMED** |

## Changes this session (test infrastructure plus reviewed production-path hardening MF-01)

- `tools/test_backend_coverage.mjs`: coverage summary matched without the legacy `#` TAP marker (Node >=22 removed it) - gate reproducible, thresholds untouched.
- Added genuine behavior tests: job-detail controller, transaction controller (idempotency key, fail-closed), create-opportunity payload mapping (MISSION vs JOB), localization copy contract.
- Removed only newly-added tests that proved non-deterministic under the full-suite runner (two widget harnesses, one validator assertion); none existed in the baseline suite; baseline tests untouched.

## Evidence

- `test-results/sessions/prebuild-qual-20260913T021809Z/` - raw logs, coverage, environment snapshot, rc ledger, failure analysis.
- `test-results/CHANGELOG-TEST-FIXES.md` - documented changes.

**Final build:** NOT PERFORMED. **Release/deployment:** NOT PERFORMED.
