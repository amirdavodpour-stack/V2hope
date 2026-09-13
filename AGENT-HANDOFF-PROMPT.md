# HOPE V7.1 — AGENT HANDOFF / EXECUTION CONTRACT

You are taking ownership of the **exact source archive contents** handed to you. Treat the repository revision you receive as the only execution source of truth for this run. Historical reports are evidence only; they never override raw execution output.

## Non-negotiable rules

1. **No fake green.** Never call anything PASS unless the command ran on the current revision and produced attributable evidence. Use `PASS / PARTIAL / UNVERIFIED / BLOCKED / FAIL`.
2. **No destructive shortcuts.** Do not delete tests, weaken assertions, lower thresholds, suppress errors, replace real integrations with mocks, or rewrite the product merely to make gates green.
3. **Instruction priority.** This document is an execution contract. Product/repository requirements, security invariants, financial invariants and explicit user instructions outrank convenience. Do not invent requirements. When two requirements conflict, preserve safety and record the conflict.
4. **Scope firewall.** Fix blockers, regressions, security/reliability defects, gate failures and required release plumbing. Put unrelated refactors/features in `FUTURE-IDEAS / V2-BACKLOG`.
5. **Evidence attribution.** Every important result must identify source revision/branch, environment, command, timestamp and artifact where applicable.
6. **Do not overwrite provenance.** Never claim that evidence came from a different archive, commit, tag or generated package.
7. **Checkpoint before stopping.** Always leave `HOPE-V7-STATE.json`, `HOPE-V7-RESUME.md`, session report/changelog and a checksumed ZIP when the environment or session ends.

## Step 0 — establish identity

Record:

```text
SOURCE_ARCHIVE
SOURCE_SHA256
GIT_PRESENT
GIT_BRANCH
GIT_SHA
VERSION
CURRENT_WAVE
CURRENT_GATE
```

If `.git` is absent, record `GIT_PRESENT=false`, `GIT_BRANCH=unknown`, `GIT_SHA=unknown`. Never invent them.

## Step 1 — prepare and police the environment

Run:

```bash
bash tools/ci-resource-guard.sh
bash tools/agent-preflight.sh
```

For GitHub Actions, provision the approved toolchain before running the preflight:

```text
Node.js 24
Java/JDK 17
Flutter 3.47.2
Android SDK platform 36
Build-tools 36.0.0
NDK 28.2.13676358
adb / platform-tools
Docker
PostgreSQL client utilities where DR tests require them
```

Do not downgrade these versions to accommodate the runner. If a required tool is unavailable, mark the relevant gate BLOCKED and preserve the raw preflight output.

### RAM / CPU / disk discipline

- Never launch multiple full Flutter/Gradle builds concurrently.
- Do not run broad test matrices in parallel unless memory headroom proves it is safe.
- Keep Gradle workers conservative (`GRADLE_WORKER_MAX` is set dynamically by the guard).
- Do not spawn ad-hoc background processes that survive the step.
- Prefer targeted tests before expensive suites.
- If the resource guard fails, do not bypass it; reduce workload only when the reduced workload is a legitimate targeted diagnostic, and never label that result as release certification.
- Before an expensive operation, check free disk/RAM again when the runner is shared or constrained.
- Clean generated build/cache directories only when they are reproducible and not required as evidence.

## Step 2 — observe before modifying

Inspect architecture, backend, Flutter, Android, tests, migrations, CI/CD, security, payment/ledger rules, release scripts and existing evidence.

Build a compact map instead of rereading the same files repeatedly.

## Step 3 — baseline gates

Run the cheapest high-value checks first:

```bash
python3 tools/check-workflows.py
bash tools/static_audit.sh
node --check backend/src/*.js
bash tools/runtime-certification-preflight.sh
bash tools/android-build-preflight.sh
```

Then, when the environment is qualified:

```bash
cd backend && npm ci
npm run test:fast
cd ..
flutter pub get --enforce-lockfile
flutter analyze
flutter test --no-pub
```

## Step 4 — minimal-change loop

For each defect:

```text
OBSERVE
→ HYPOTHESIS
→ VERIFY
→ MINIMAL FIX
→ TARGETED TEST
→ REGRESSION TEST
→ SIDE-EFFECT AUDIT
→ CHECKPOINT
```

Every fix must be classified as one of:

```text
ROOT_CAUSE_FIX
MITIGATION
WORKAROUND
COMPATIBILITY_FIX
TEST_FIXTURE_CHANGE
DOCUMENTATION_FIX
```

## Step 5 — mobile/release path

Use the canonical helpers already present in the repository. Do not duplicate expensive Flutter/Gradle operations in separate workflow steps.

Approved sequence:

```bash
bash tools/ci-resource-guard.sh
bash tools/android-build-preflight.sh
flutter pub get --enforce-lockfile
flutter analyze
flutter test --no-pub
API_BASE_URL=https://staging.api.hope.app BUILD_PROFILE=pilot bash tools/build_apk_debug.sh
```

For release certification, additionally execute the repository's release helper, artifact metadata checks, checksum, install/launch and integration runtime tests. Never convert build existence into install/runtime proof.

## Step 6 — staging / DR / provider gates

A certification PASS requires the actual outcomes of all mandatory gates, including:

```text
Postgres runtime
S3/storage runtime
performance smoke
product workflow
provider integration
notification/provider delivery when required
Android/device certification
DR restore
```

A skipped optional notification probe must not be represented as a successful provider-delivery test. Keep `SKIPPED`/`UNVERIFIED` distinct from PASS.

## Step 7 — adversarial review

Before calling a gate PASS, ask:

```text
Could this PASS be stale?
Could it come from another revision?
Did a mock replace a real boundary?
Was the negative path exercised?
Did the environment differ materially from production/staging?
Could artifact metadata belong to another build?
Did a timeout hide a failure?
Did resource pressure cause an incomplete run?
```

Resolve or explicitly document every material uncertainty.

## Step 8 — mandatory handoff artifacts

Update:

```text
HOPE-V7-STATE.json
HOPE-V7-RESUME.md
SESSION-<N>-REPORT.md
SESSION-<N>-CHANGELOG.md
```

The state must contain:

```text
PROJECT
VERSION
SOURCE_SHA256
GIT_BRANCH
GIT_SHA
CURRENT_WAVE
CURRENT_GATE
COMPLETED
FAILED
BLOCKED
UNVERIFIED
RISKS
DECISIONS
CHANGED_FILES
TESTS_RUN
TESTS_NOT_RUN
EVIDENCE
ARTIFACTS
ROLLBACK_POINT
NEXT_EXACT_ACTION
EXPECTED_RESULT
STOP_CONDITION
```

## The exact success condition

Do **not** declare V1 COMPLETE until all mandatory release gates have current execution evidence, including Flutter/Android build, install/launch/runtime, staging/provider, DR restore, security and release provenance.

When the environment prevents a mandatory gate, deliver a high-quality `PARTIAL`/`BLOCKED` package with exact resume instructions rather than pretending the gate passed.
