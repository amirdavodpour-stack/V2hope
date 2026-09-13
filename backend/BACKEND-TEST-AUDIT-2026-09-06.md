# Backend Test Audit — 2026-09-06

## Result

The backend test suite was audited beyond the existing contract/static tests.

- Before hardening: 451 tests, 447 passed, 4 conditional skips.
- After hardening: 462 tests in the normal suite, 458 passed, 4 conditional skips.
- Added PostgreSQL repository E2E coverage as a separate conditional integration test.
- `npm run check` passes.
- `npm test` passes with zero failures.
- `npm run test:coverage` is available for native Node coverage reporting.

## New executable coverage

`tests/backend-edge-cases.test.mjs` adds runtime coverage for:

- analytics normalization, primitive preservation and validation;
- telemetry privacy filtering and crash redaction;
- geographic coordinate validation and boundary conditions;
- recommendation ranking edge cases;
- business health thresholds;
- payment simulator refund idempotency;
- payment provider transient retry and malformed-response handling;
- notification provider URL validation and transient retry;
- JSON request parsing and request-size/content-type enforcement;
- local storage upload/delete behavior and direct-upload rejection.

`tests/postgres-repository-e2e.test.mjs` adds a real-PostgreSQL execution path for:

- registration;
- categories;
- job creation/publication;
- offer creation/acceptance;
- funding and idempotent replay;
- job lifecycle through completion;
- evidence creation;
- payment release/settlement;
- direct database assertions for payment/job/ledger consistency.

## Bugs found and fixed by the new tests

1. `src/analytics.js`
   - `cleanValue()` treated booleans as numbers and converted them to `null`.
   - crash credential redaction preserved the secret value on `token=...`, `password=...`, etc.

2. `src/application/geo.js`
   - `parseCoordinate()` accepted out-of-range latitude/longitude values.
   - It now rejects latitude outside `[-90, 90]` and longitude outside `[-180, 180]`.

## Remaining coverage gap

The largest remaining gap is not unit correctness but execution of PostgreSQL repository code in the current local environment. The repository modules intentionally require a real PostgreSQL pool, and this container has no PostgreSQL service available. The project already has staging/CI PostgreSQL runtime gates; the new repository E2E test is wired into `npm run test:postgres` so CI can execute it against a real database.

Native local coverage currently reports roughly 72% line coverage for the non-live environment. Repository files are lower locally because their real SQL paths require PostgreSQL. This should be interpreted as an environment/runtime-coverage gap, not evidence that the SQL layer is untested in CI.

## Recommended release gate

For a release-grade backend gate, run:

```bash
npm run check:all
npm run test:coverage
npm run test:postgres   # with DATABASE_URL pointing at CI/staging PostgreSQL
npm run test:s3         # with S3_INTEGRATION=1 and a reachable S3-compatible service
```
