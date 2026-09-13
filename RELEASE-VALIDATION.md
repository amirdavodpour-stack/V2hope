# HOPE V2 4.0.8+7 — Release Validation

This document defines the repeatable local/CI validation gate for the current release candidate.

## Run

```bash
./tools/release_candidate_check.sh
```

The gate always runs repository-local checks first. It then checks whether the environment can execute Flutter and Docker validation. Missing external tooling is reported as **BLOCKED**, never as PASS.

## Required gates

- Static audit
- Localization parity
- UX contract
- Backend full regression suite
- Product requirements tests
- Performance smoke test
- Flutter analyze
- Flutter tests
- Docker Compose configuration validation
- Android emulator device integration smoke against staging HTTPS

## External release gates still requiring real infrastructure

- Android physical-device matrix (the emulator gate is automated; physical hardware remains external evidence)
- Production/sandbox PSP credentials and end-to-end money flow
- FCM/APNs provider delivery
- Real email provider delivery
- S3/MinIO end-to-end object lifecycle
- Load/soak testing against realistic data volume
- Independent penetration test
- Production signing verification in CI

A release may not be labelled fully production-ready while any of the external gates above remain unverified.

## Operational gates
- `backend/scripts/verify-backup.sh` must structurally validate a PostgreSQL custom-format archive before restore.
- `/live` must remain independent from database availability; `/ready` must fail closed when PostgreSQL is unavailable.
- `/metrics` must expose bounded latency and process-memory telemetry without secrets or raw database error messages.


## Integration certification

Before production signing, the release workflow must execute: PostgreSQL migration against the configured staging database, the backend E2E suite, and the S3 integration suite with staging credentials. These are hard gates and must pass before the production keystore is configured.

A release is not certified solely by offline tests. The certification record must retain the workflow run, commit SHA, staging smoke result, E2E result, S3 result, and isolated PostgreSQL restore evidence.

### Multi-instance staging gate
- [ ] Boot `backend/staging/docker-compose.yml` with Docker Compose.
- [ ] Verify both API replicas report `/ready` through the Nginx gateway.
- [ ] Verify shared PostgreSQL state across replicas.
- [ ] Verify shared S3-compatible object storage is reachable from both replicas.
- [ ] Verify PostgreSQL-backed rate limiting remains consistent across replicas.
- [ ] Run `tools/staging-local.sh` and retain its output as staging evidence.


### Android runtime certification
The device-integration workflow now runs `tools/android-runtime-cert-contract.sh` before booting the emulator and the integration smoke exercises registration, authenticated access, and refresh-token rotation against the HTTPS staging endpoint.

## Authoritative release contract (2026-09-06)

The authoritative configuration source is `docs/CONFIGURATION-CONTRACT.md` plus `backend/src/config.js` and `backend/scripts/validate-production-env.sh`.

Production release requirements are:

- Workflow dispatch must target an immutable tag named exactly `v<pubspec version>`.
- The tag must resolve to the checked-out `GITHUB_SHA`.
- Staging certification SHA must equal the production release SHA.
- The canonical signed APK is `artifacts/HOPE-<pubspec version>-production.apk` and its `.sha256` sidecar is published with the release manifest.
- `backend/tools/release_manifest.mjs` records application version, Android metadata, and available Flutter/Android/Gradle toolchain versions.
- Historical session reports are evidence only; they do not override current machine-verifiable gates.
