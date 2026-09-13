## 2026-09-13 — V19 final regression/test-harness hardening

- Made `test:offline` process-isolated so per-test `process.env` and runtime state cannot bleed across test files.
- Fixed migration contract coverage for migration 003 (`RELEASE_FAILED`).
- Removed the non-boundary `providerRefMatches` helper export so repository boundary fail-closed coverage only targets SQL-backed methods.
- Fixed mobile marketplace creation to resolve the use case through `ApplicationRegistry` instead of constructing a Repository-backed use case in the widget.
- Updated stale mobile taxonomy/notification contracts to assert the current ApplicationRegistry boundary.
- Restored executable bits on packaged shell scripts and added a contract test for the isolation runner.

## 2026-09-13 — V18 Authorization / BOLA hardening

- Scoped employer-side application lifecycle mutations to both the authenticated owner and the route `jobId`.
- Prevented a same-owner cross-job application identifier from mutating an application belonging to another job.
- Applied the same protection to interview, offer, and hire transitions in both PostgreSQL and explicit test-mode runtime paths.
- Added `backend/tests/authorization-bola-v18.test.mjs` with an executable cross-job regression and repository contract coverage.
- Revalidated the backend contract suite at 74/74 passing and the focused security/storage/notification/payment suites used for this hardening.
- Updated repository-port contract coverage for `getAdminFinancialSummary()` so the payment capability slice matches the payment application use case.
- No production thresholds, tests, or runtime gates were weakened or removed.

## 2026-09-13 — V8 consistency hardening

- Fixed PostgreSQL refund idempotency retry semantics: a terminal `FAILED` refund can be safely reopened with the same idempotency key instead of being returned as a dead operation.
- Preserved the original refund record/operation identity and re-queues the existing payment refund outbox event.
- Added focused contract coverage for terminal-failure recovery and payment `HELD` restoration.
- Added the refund contract to the backend contract suite.
- No production thresholds, runtime gates, or existing tests were weakened or removed.

## 2026-09-13 — Architecture hardening

- Decoupled application/policy/service modules from the HTTP transport by centralizing the shared error contract in `backend/src/api/http_error.js`.
- Preserved the existing `HttpError` import surface from `backend/src/http.js` for compatibility.
- Added a transport-boundary architecture contract and maintenance evidence.

# Changelog

All notable project changes are documented here. This changelog focuses on
verified engineering changes and test-infrastructure hardening; historical
session evidence remains under `test-results/sessions/`.

## [Unreleased] — Pre-certification hardening

### Added
- Deterministic disposable PostgreSQL test runner at
  `backend/tools/run-postgres-isolated.mjs`, including forced teardown.
- Runtime qualification inventory at `tools/runtime-qualification-inventory.mjs`.
- Test-state integrity validation at `tools/validate-test-state.mjs`.
- Flutter behavior tests covering admin, create-job, home navigation,
  transaction and job-detail flows.
- Certification gap map and current test-state evidence under `test-results/`.

### Changed
- PostgreSQL production persistence boundaries were tightened so the
  PostgreSQL path does not fall back through the legacy collection adapter.
- Backend coverage gate parsing was hardened for modern Node TAP output.
- Coverage gate execution is explicitly pinned to `NODE_ENV=test`.
- Agent handoff contract inputs were restored and validated.
- Test/package handling was hardened to preserve executable permissions and
  exclude machine-local Android configuration.
- Test evidence and state files were synchronized around canonical sessions.

### Verification
- Latest verified Flutter suite: 414/414 passing; analyze reports 0 issues;
  line coverage gate 78.26%.
- Latest verified backend baseline: 217/217 fast tests; backend coverage
  81.21% line / 70.65% branch / 74.02% functions.
- PostgreSQL isolated runner: 3 clean repetitions, 4/4 each, with no
  leftover test databases.
- Final production build and deployment have not been performed.

## Historical sessions

Detailed historical results are retained in:
`test-results/sessions/`

The current canonical project status is maintained in:
- `README-TEST-STATUS.md`
- `TEST-COMPLETION-STATE.json`
- `test-results/TEST-SUMMARY.json`
## Architecture hardening V9 — 2026-09-13

- Hardened employer-side application lifecycle concurrency by locking the Job aggregate before the Application row.
- Prevented concurrent acceptance of different candidates for the same Job from racing into successive `provider_id` overwrites.
- Added `backend/tests/application-concurrency-contract.test.mjs` to preserve the canonical `job -> application` lock ordering.
- No thresholds, existing tests, or runtime gates were weakened or removed.

## V10 — Concurrency / Uniqueness Hardening

- Closed check-then-insert races for pending offers and candidate applications.
- PostgreSQL partial unique constraints remain the authoritative concurrency guard.
- Repository converts duplicate-constraint violations into stable domain errors (`OFFER_EXISTS`, `APPLICATION_EXISTS`).
- HTTP routes map those domain errors to deterministic `409 Conflict` responses.
- Added `backend/tests/race-constraint-contract.test.mjs`.
- Focused integrity/security suite: 36/36 passed.
- No production threshold, test, or runtime gate was weakened.

## Architecture Hardening — Release Recovery

- Added explicit `RELEASE_FAILED` payment state for terminal payment-release failures.
- Added migration `003_payment_release_recovery` so existing PostgreSQL deployments receive the expanded payment status constraint safely.
- Release retry reuses the existing outbox dedupe key and reopens `RELEASE_FAILED` to `RELEASE_PENDING` without creating duplicate ledger/settlement effects.

## Unreleased — Security/Consistency Hardening
- Bound signed payment webhook event IDs to payload event IDs.
- Hardened payment webhook aggregate/provider-reference validation.
- Added RELEASE_FAILED reconciliation coverage and fail-closed migration rollback semantics.

## V16 — Notification Device Ownership Hardening
- Prevented notification-device token rebinding across user accounts in both PostgreSQL and explicit legacy test runtime.
- PostgreSQL registration now locks the existing token row before deciding whether it may be updated, eliminating a cross-user takeover edge and preserving token uniqueness.
- Added focused ownership contract coverage.

## 2026-09-13 — V17 security/financial hardening
- Routed admin financial summary through the payment application boundary instead of direct repository access.
- Prevented deletion of jobs that already have financial records in both PostgreSQL and explicit test/local runtime.
- Included `RELEASE_FAILED` in financial pending summaries.
- Added/updated admin security architecture contracts for the deletion and financial-summary boundaries.
- Validation: focused security/admin suite 19/19 PASS; contract suite 74/74 PASS; modified-file syntax checks PASS.

- 2026-09-13: hardened service/composition persistence boundaries with explicit app/session legacy adapters; fast, contract, and architecture suites remain green.
