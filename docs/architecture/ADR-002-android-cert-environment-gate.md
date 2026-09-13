# ADR-002 — Environment Gate for Android Certification

**Date:** 2026-09-12
**Status:** Accepted
**Deciders:** Delivery Engine (autonomous)
**Context:** W2 (Android Certification) attempted, blocked by environment.

## Context

W2's objective is to produce and certify a debug + release APK. The
`tools/runtime-certification-preflight.sh` contract requires: node 24,
java 17, flutter 3.47.2, adb, javac, docker, psql, pg_dump, pg_restore.
The W2 execution environment observed on 2026-09-12 supplied only node,
npm, and java (v21 — wrong major). Preflight printed
`RUNTIME_PREFLIGHT_FAIL`. Attempting the build anyway would produce a
false-green artifact or a broken APK — both violate the "No Fake Green"
policy.

## Decision

Android certification MUST NOT run in an environment that does not pass
`tools/runtime-certification-preflight.sh`. When preflight fails, W2 is
formally BLOCKED, the gap is recorded in `evidence/w2/preflight.log`,
and all non-toolchain work (static audits, reconciliation, packaging,
runbook) is completed as **W2-Prep** on branch `w2-prep`, so the next
qualified runner can complete W2 in a single session.

The failing preflight is treated as a hard release blocker, not a
"try harder" signal.

## Alternatives considered

1. **Install the toolchain on-the-fly.** Rejected: ~4–6 GB download,
   unstable networks in sandboxes, unbounded time cost, and the produced
   binaries would still not be reproducible on the official runner.
2. **Weaken the preflight contract** (drop `adb`/`docker` etc.).
   Rejected: violates No Fake Green — the contract is what defines
   "qualified runner" and staging integration depends on it.
3. **Skip W2 and go to W3.** Rejected: R1/R2 stay OPEN, staging depends
   on a certified APK, and the release critical path lengthens.

## Consequences

- W2 has an explicit "Environment Gate" as its first step, deterministic
  and machine-checkable.
- Work that does not depend on toolchain (static reconciliation, runbook,
  release script hardening) is executed early and lands on `w2-prep`,
  so the qualified runner starts from a strictly better position.
- The 283/283 vs 367/4-fail archive claim conflict is reconciled by
  static analysis (see `docs/audit/FLUTTER-TEST-COUNT-RECONCILIATION.md`)
  to unblock reasoning, but the numeric decision still awaits a real
  `flutter test --no-pub` run.
