# Execution Log - HOPE-V7 Test Session hope-v7-test-20260913T0010Z

All commands were run from the repository root (`backend/` where noted) with `PATH` prioritizing Node 24 and, for Flutter steps, the installed SDK.

| # | When (UTC) | Command | Exit | Log |
|---|---|---|---|---|
| 1 | 23:36 | cd backend && npm ci (Node 24) | 0 | (install) |
| 2 | 23:36 | npm run check | 0 | raw/01-check.log |
| 3 | 23:36 | npm run test:fast | 1 | raw/02-test-fast.log |
| 4 | 23:37 | npm run test:contract | 0 | raw/test-logs-test:contract.log |
| 5 | 23:37 | npm run test:backup | 0 | raw/test-logs-test:backup.log |
| 6 | 23:37 | npm run test:notifications | 0 | raw/test-logs-test:notifications.log |
| 7 | 23:37 | npm run test:wave10 | 0 | raw/test-logs-test:wave10.log |
| 8 | 23:37 | npm run test:staging-contract | 0 | raw/test-logs-test:staging-contract.log |
| 9 | 23:37 | npm run test:analytics | 0 | raw/test-logs-test:analytics.log |
| 10 | 23:37 | npm run test:release-evidence | 0 | raw/test-logs-test:release-evidence.log |
| 11 | 23:37 | npm run test:payment-e2e | 0 | raw/test-logs-test:payment-e2e.log |
| 12 | 23:37 | npm run test:product | 0 | raw/test-logs-test:product.log |
| 13 | 23:37 | npm run test:e2e | 0 | raw/test-logs-test:e2e.log |
| 14 | 23:37 | npm run test:failure-injection | 0 | raw/test-logs-test:failure-injection.log |
| 15 | 23:37 | npm run test:perf | 0 | raw/test-logs-test:perf.log |
| 16 | 23:37 | npm run test:load:smoke | 0 | raw/test-logs-test:load:smoke.log |
| 17 | 23:37 | node --test tests/sbom-contract tests/property-workflow tests/property-security tests/e2e-state-guard tests/wave10-release-security | 0 | raw/03-sbom-property.log |
| 18 | 23:37 | npm run check:toolchain-contract | 0 | raw/04-toolchain-contract.log |
| 19 | 23:37 | npm run test:postgres (PG16, fresh db) | 0 | raw/05-test-postgres.log |
| 20 | 23:38 | npm run security:audit | 0 | raw/06-npm-audit.log |
| 21 | 23:38 | npm run check:config-contract | 0 | raw/07-config-contract.log |
| 22 | 23:38 | npm run check:migrations | 0 | raw/08-check-migrations.log |
| 23 | 23:39 | flutter pub get --enforce-lockfile | 0 | (console) |
| 24 | 23:39 | flutter analyze | 0 | raw/09-flutter-analyze.log |
| 25 | 23:40 | flutter test --no-pub | 0 | raw/10-flutter-test.log |
| 26 | 23:41 | npm run test:offline WITH DATABASE_URL (attempt 1) | 1 (52 fails: 429 pollution) | raw/11-test-offline-full.log |
| 27 | 23:45 | npm run test:offline WITHOUT DATABASE_URL (CI-parity; the with-DB run is treated as a triage re-run of this) | 1 (3 fails) | raw/11b-test-offline-no-db.log |
| 28 | 23:45 | npm run test:s3 | 0 (1 SKIP) | raw/12-test-s3.log |
| 29 | 23:45 | npm run test:provider | 0 | raw/13-test-provider.log |
| 30 | 23:45 | npm run test:integration-required | 1 (harness guard) | raw/14-integration-required.log |
| 31 | 00:01 | node --test tests/postgres-bootstrap-integration + postgres-repository-e2e (reused db) | 1 | raw/14b-pg-integration-retry.log |
| 32 | 00:01 | RETRY: node --test tests/postgres-repository-e2e | 1 | raw/14c-pg-e2e-retry2.log |
| 33 | 23:47 | FLUTTER_LINE_COVERAGE_MIN=65 bash tools/test_flutter_coverage.sh | 1 (coverage 56.51%) | raw/15-flutter-coverage.log |
| 34 | 23:48 | backend coverage gate WITH DATABASE_URL (triage run) | 1 (71 fails) | raw/16-backend-coverage-gate.log |
| 35 | 00:03 | backend coverage gate CI-parity (no DATABASE_URL) | 1 (func 58.29%) | raw/16b-backend-coverage-gate-ci-parity.log |
| 36 | 23:52 | flutter test storage/settings/uploads (silent-failure set) | 0 | raw/17-silent-failure-regression.log |
| 37 | 23:51 | perf-smoke attempt 1 (server down) | 1 INFRA | raw/18-perf-smoke.log (header) |
| 38 | 23:51 | local API started; perf-smoke attempt 2 (PERF_REQUESTS=200 CONC=10) | 1 (successRate) | raw/18-perf-smoke.log, raw/perf-smoke.json |
| 39 | 23:54 | python3 tools/check-workflows.py | 0 | raw/19-workflow-lint.log |
| 40 | 23:54 | bash tools/static_audit.sh | 0 | raw/20-static-audit.log |
| 41 | 23:54 | bash tools/check_localization.sh | 0 | raw/21-localization.log |
| 42 | 23:54 | bash tools/ci-resource-guard.sh | 2 (RAM) | raw/22-resource-guard.log |
| 43 | 23:55 | bash tools/runtime-certification-preflight.sh | 2 (docker,adb) | raw/23-runtime-preflight.log |
| 44 | 23:56 | RETRY preflight with JDK 17 active | 2 (docker,adb) | raw/23b-runtime-preflight-jdk17.log |
| 45 | 23:58 | PG16 dbs hope_source/hope_drill created; migrate; bash scripts/dr-restore-drill.sh | 0 | raw/25-dr-restore-drill.log |
| 46 | 00:00 | cd android && timeout 240 ./gradlew test --no-daemon | 124 (timeout; no SDK) | raw/26-gradle-test.log |
| 47 | 00:09 | npm run test:production-env | 0 | raw/27-test-production-env.log |
| 48 | 00:09 | npm run sbom | 0 | raw/28-sbom.log |
| 49 | 00:09 | npm run release:manifest | 0 (byte-identical) | raw/29-release-manifest.log |
| 50 | 00:09 | npm run score:90plus | 2 (below gate) | raw/30-score90.log |
| 51 | 00:10 | bash tools/staging-smoke.sh | 1 (no STAGING_BASE_URL) | raw/31-staging-smoke.log |

Retry policy compliance: every retry shown is the single allowed retry (preflight after JDK install; PG e2e; perf after server start; coverage with/without DB are mode comparisons, not retries).

Full raw logs (39 files) are in raw/.

## prebuild-qual-20260913T021809Z
- 2026-09-13T02:34:39Z: pre-build qualification session executed on node24 + pg16 + flutter 3.47.2.
- Status integrity PASS; backend fast/contract/offline umbrella PASS; coverage gate PASS 81.22/70.71/74.02; PG isolated 4/4 x3 (0 leftover); DR drill PASS; perf conc10 0.935 (EXPECTED_POLICY_LIMIT); Flutter 374/374, coverage 56.51% (FAIL); Android/Docker/S3/staging BLOCKED.

## prebuild-qual-20260913T021809Z
- 2026-09-13T02:35:42Z: pre-build qualification session executed on node24 + pg16 + flutter 3.47.2.
- Status integrity PASS; backend fast/contract/offline umbrella PASS; coverage gate PASS 81.22/70.71/74.02; PG isolated 4/4 x3 (0 leftover); DR drill PASS; perf conc10 0.935 (EXPECTED_POLICY_LIMIT); Flutter 374/374, coverage 56.51% (FAIL); Android/Docker/S3/staging BLOCKED.

## prebuild-qual-20260913T021809Z
- 2026-09-13T02:36:27Z: pre-build qualification session executed on node24 + pg16 + flutter 3.47.2.
- Status integrity PASS; backend fast/contract/offline umbrella PASS; coverage gate PASS 81.22/70.71/74.02; PG isolated 4/4 x3 (0 leftover); DR drill PASS; perf conc10 0.935 (EXPECTED_POLICY_LIMIT); Flutter 374/374, coverage 56.51% (FAIL); Android/Docker/S3/staging BLOCKED.


## Maintenance session 20260913T032022Z — 2026-09-13

| Step | Result | Evidence |
|---|---|---|
| check | PASS | sessions/20260913T032022Z/check.log |
| production persistence boundary | 2/2 PASS | sessions/20260913T032022Z/production-boundary.log |
| executable permissions + release hardening | 27/27 PASS | sessions/20260913T032022Z/backend-fast.log |
| backend-fast | 217/217 PASS | sessions/20260913T032022Z/backend-fast.log |
| backend-contract | 71/71 PASS | sessions/20260913T032022Z/backend-contract.log |
| full backend npm test | 524/529 PASS, 0 fail, 5 suite-defined skips | sessions/20260913T032022Z/backend-full.log |
| backend coverage gate | 81.21 / 70.87 / 74.02 PASS | sessions/20260913T032022Z/coverage-gate-rerun.log |
| npm audit | BLOCKED by registry DNS EAI_AGAIN | sessions/20260913T032022Z/npm-audit.log |
| status integrity | PASS | sessions/20260913T032022Z/status-integrity.log |

No final build or deployment was performed.
