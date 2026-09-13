# HOPE-V7 — Post-Test Corrections

## Scope
This correction session is based on the Genspark remaining-test report for `HOPE-V7-TESTED-COMPLETE-PROJECT.zip`.

No production build, release artifact, deployment, real payment, real notification, or production data mutation was performed.

## Corrections applied

### F1 — Agent handoff contract completeness
Restored the two required contract artifacts from the original S11 project source:

- `AGENT-HANDOFF-PROMPT.md`
- `AGENT-RESOURCE-POLICY.md`

These were accidentally removed during the previous clean-packaging pass. The implementation source was not changed.

Verification:
- `node --test backend/tests/agent-handoff-contract.test.mjs` → **6/6 PASS**

### PostgreSQL E2E isolation
Added a dedicated isolated database runner:

- `backend/tools/test-postgres-isolated.mjs`
- `npm run test:postgres:isolated`
- `backend/tests/postgres-isolation-runner-contract.test.mjs`

The runner creates a uniquely named disposable PostgreSQL database, runs the PostgreSQL integration suites against it, and drops the database with `WITH (FORCE)` afterwards. It does not modify a shared/dirty test database.

Verification:
- runner syntax check → **PASS**
- isolation contract → **1/1 PASS**

### Regression verification
- `npm run check` → **PASS**
- `npm run test:fast` → **217/217 PASS**

## Deliberately not changed

The following remain open because changing their gates or semantics without evidence would hide the underlying issue:

- Flutter line coverage gate: 56.51% < 65%
- Backend line/function coverage gate: 65.59% / 58.29% below 70% / 65%
- Performance smoke success-rate gate: 0.935 < 0.995 (429 throttling under burst)
- Android / Docker / S3 / deployed staging blockers

## Release state

**NOT RELEASE-CERTIFIED.**

**FINAL BUILD: NOT PERFORMED.**


## Local maintenance update (2026-09-13)
- Added `backend/tests/coverage-depth-targets.test.mjs` with behavior tests for row mappers, payment policy, webhook normalization/application, and safe database-runtime behavior.
- Targeted execution: 5/5 PASS.
- No coverage threshold or assertion was changed.
- This addition is intended to improve genuine backend coverage; the official session evidence remains the Genspark session recorded under `test-results/sessions/20260913T012657Z/`.

## Local maintenance verification — local-maintenance-20260913T020145Z

- Added `backend/tests/coverage-depth-targets.test.mjs` with seven targeted behavior/contract tests covering row mapping, payment policy/webhook behavior, migration orchestration, database runtime safety, and repository boundary fail-closed behavior.
- Targeted suite: **7/7 PASS**.
- `backend/npm test`: **527 tests, 522 pass, 0 fail, 5 skipped** in this local environment.
- `backend/npm run check`: **PASS**.
- Canonical `backend/npm run test:coverage-gate`: **PASS** — line **81.24%**, branch **70.66%**, functions **74.02%**.
- `backend/package.json` was hardened so the coverage gate itself runs with `NODE_ENV=test`.
- No coverage threshold was lowered and no production application behavior was changed.
- Official Genspark session evidence remains authoritative for its own runner; this local maintenance result should be revalidated by Genspark/CI before being treated as globally certified.
