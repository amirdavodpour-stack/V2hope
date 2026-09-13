# HOPE Release / Staging Bootstrap

## Single entry point

Use `.github/workflows/bootstrap.yml`.

- `mode=staging`: runs the complete staging certification workflow.
- `mode=release`: runs staging certification first and only proceeds to production release when every required gate passes on the exact same commit.
- For release, `confirm` must be exactly `release`.

## Release boundary

Production release requires:

1. staging certification status `PASS`;
2. staging certification SHA equal to the release SHA;
3. an immutable tag `v<pubspec version>` resolving exactly to that SHA;
4. production environment validation;
5. complete backend quality/security gates;
6. Android toolchain and Flutter validation;
7. signed production APK verification;
8. release manifest and SBOM evidence;
9. build provenance attestation.

No test is skipped, deleted, weakened, or threshold-reduced by this bootstrap.

## Staging boundary

Staging certification requires PostgreSQL, S3/MinIO, real external staging performance, real staging product workflow, provider integration, Android emulator integration, and an isolated PostgreSQL DR restore. Optional notification delivery is tested when its three notification secrets are configured; otherwise that optional probe is explicitly skipped and the core staging gates remain mandatory.

## Important CI fixes included

- Flutter/Gradle build directories are aligned so a successful Gradle build produces the canonical Flutter APK path.
- Staging certification emits uppercase `PASS`, matching the production release contract.
- Notification secrets are exposed at job scope so the notification condition is evaluated correctly.
- Staging uses the configured HTTPS `STAGING_BASE_URL` instead of a hard-coded endpoint for the staging APK and product/device tests.
- DR restore uses a separate `hope_drill` database, satisfying the drill script's isolated-target requirement.
- Provider evidence requires the product workflow and provider integration, plus successful notification delivery when that optional probe is enabled.
- Production release is reusable by the bootstrap workflow while remaining manually dispatchable.
- All third-party GitHub Actions remain pinned to immutable SHAs.
