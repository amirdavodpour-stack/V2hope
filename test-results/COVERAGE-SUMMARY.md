# Coverage Summary — HOPE-V7

**Canonical current session:** `20260913T040220Z` (2026-09-13) - remaining-gaps qualification (GAP-A closure).
Historical qualification sessions remain in `test-results/sessions/` and are not the current state.

## Flutter — current (this session)

| Metric | Current | Gate | Status |
|---|---:|---:|---|
| Line | **78.26%** | >=65% | **PASS (GAP-A CLOSED)** |
| Full tests | **414/414 PASS** | — | PASS |
| Analyze | **0 issues** | — | PASS |

Evidence: `sessions/20260913T040220Z/flutter-coverage-gate.log`, `sessions/20260913T040220Z/flutter-full-suite.log`, `sessions/20260913T040220Z/flutter-analyze-final.log`.

Prior session value: 57.45% (388/388). Delta to gate closed by 26 behavior-based widget tests in admin, create-job, home, transaction and job-detail modules. Threshold unchanged; no source excluded.

## Backend — verified 20260913T032022Z (NOT re-run; no backend change this session)

| Metric | Current | Gate | Status |
|---|---:|---:|---|
| Line | **81.21%** | >=70% | PASS |
| Branch | **70.87%** | >=60% | PASS |
| Function | **74.02%** | >=65% | PASS |

Evidence: `sessions/20260913T032022Z/coverage-gate-rerun.log`.

## Historical measurements

### `prebuild-qual-20260913T021809Z`
Backend: 81.22% line / 70.65% branch / 74.02% function. Flutter: 57.45% line; 388/388 tests passed.

### `20260913T012657Z`
Backend: 68.70% line / 74.24% branch / 59.66% function. Flutter: 56.51% line; 374/374 tests passed.

Historical values are retained for audit purposes only.
