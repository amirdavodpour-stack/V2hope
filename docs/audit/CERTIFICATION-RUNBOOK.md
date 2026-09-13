# HOPE-V7 Runtime Certification Runbook

## Purpose

This runbook is the handoff for the final runtime-certification stage. It is
intentionally limited to the nine runtime evidence gates consumed by
`backend/tools/90plus-score.mjs`. It does not replace the project's existing
CI workflows.

## Canonical gate list

1. `flutter_toolchain`
2. `android_build`
3. `device_certification`
4. `postgres_runtime`
5. `s3_runtime`
6. `provider_runtime`
7. `dr_restore`
8. `perf_run`
9. `npm_audit`

Runtime evidence is accepted by the scorecard only when the artifact is
created by the real CI evidence writer and carries a traceable GitHub Actions
run URL plus a fresh timestamp. Never hand-create a passing evidence artifact.

## Recommended execution order

### Stage 1 — CI baseline

Run the normal Node/Flutter quality workflow first. This establishes the
target Node 24 / Flutter 3.47.2 environment and emits `flutter_toolchain` and
`npm_audit` evidence.

### Stage 2 — Runtime infrastructure

Run the staging certification workflow on its certified runner. It provisions
PostgreSQL and MinIO for controlled integration testing and requires the real
staging base URL plus any optional provider secrets.

This stage is responsible for:
- PostgreSQL runtime;
- S3/R2-compatible runtime;
- performance runtime;
- provider runtime;
- device certification;
- DR restore.

The workflow must finish its gates successfully before the corresponding
evidence files are considered proven.

### Stage 3 — Device certification

If device certification is run independently, use
`.github/workflows/device-integration.yml`. The workflow uses the repository
toolchain and writes `device_certification` evidence from the actual emulator
run.

### Stage 4 — Android build

`android_build` is a distinct gate in the current scorecard and requires the
release workflow's signed-artifact evidence. This gate is intentionally NOT
satisfied by a local debug APK or by merely compiling Android instrumentation
tests.

## Required infrastructure / secrets

- GitHub Actions runner meeting `AGENT-RESOURCE-POLICY.md`, including the
  repository RAM floor.
- Node 24.
- JDK 17.
- Flutter 3.47.2.
- Android SDK 36 and emulator/device capability.
- Docker/Actions service-container capability where the workflow requires it.
- PostgreSQL service capability.
- A safe S3/R2 sandbox or equivalent workflow-provisioned object storage.
- `STAGING_BASE_URL` for deployed staging runtime.
- Provider sandbox credentials/endpoints needed by the provider gate.
- Production release keystore is only required for the distinct production
  Android-build gate and must never be stored in this repository.

## Evidence integrity

Use:

`backend/tools/write-evidence.mjs`

The writer fails closed unless `CI=true` and a real GitHub Actions run URL is
available. The scorecard independently verifies the evidence shape and age.

## Performance policy

The current local performance diagnostic is classified as an expected
rate-limit policy limit. Do not lower the success-rate threshold or weaken
the production rate limiter. The final `perf_run` gate must come from the
sanctioned staging/load-test path defined by the CI workflow.

## Current local state

The following local/static work is already closed:
- Flutter coverage gate: PASS at 78.26%.
- Backend coverage gate: PASS at 81.21 / 70.65 / 74.02.
- PostgreSQL isolated tests: PASS, 3 clean repetitions.
- Agent handoff: PASS 6/6.
- Status integrity: PASS.
- Root CHANGELOG.md present.
- SECURITY-THREAT-MODEL.md present.

The remaining scorecard deficit is runtime evidence, not a request to repeat
already-green unit/contract suites.
