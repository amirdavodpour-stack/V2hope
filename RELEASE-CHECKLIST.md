# HOPE V2 4.0.20 Release Checklist

## Certification policy
External evidence required before production certification: signed-APK device installs, real PSP/push/email/S3 provider delivery, and end-to-end staging verification must all be captured with real credentials outside this offline audit environment before `RELEASE-STATUS` may read `RELEASE-CANDIDATE`.

## Automated gates
- [ ] `npm ci` succeeds from a clean checkout.
- [ ] PostgreSQL 16 migration + full backend test suite passes.
- [ ] MinIO S3 integration passes (upload/head/signature validation).
- [ ] Performance smoke passes under 100 concurrent health probes.
- [ ] `npm audit --audit-level=high` has no high/critical findings, or accepted risk is documented with an expiry.
- [ ] `npm run test:offline` passes from a clean checkout.
- [ ] Flutter analyze, widget tests, and integration test pass.
- [ ] Release APK builds successfully.
- [ ] Android API 36 emulator installs, launches, force-stops, and relaunches the release APK.
- [ ] Security workflow passes repository security gates and the SBOM is regenerated and contract-validated.

## Operational gates
- [ ] `/health` reports database `ok`.
- [ ] `/ready` reports `ready=true`.
- [ ] `/metrics` is protected by `METRICS_TOKEN`.
- [ ] Database backup produced with `backend/scripts/backup.sh`.
- [ ] Backup restored successfully into an isolated PostgreSQL instance using `backend/scripts/restore.sh`.
- [ ] Outbox pending/failed counts are reviewed before production cutover.

## Rollback
- Keep previous container image and APK artifact available.
- Revert application deployment independently from database migration where possible.
- Never destroy the previous PostgreSQL backup before post-deploy verification completes.

- [ ] Recruitment lifecycle integration tested on staging
- [ ] Employer candidate anonymization verified on staging
- [ ] Single-hire invariant verified on staging

## Production hardening
- [ ] Configure real `API_BASE_URL_PRODUCTION` over HTTPS.
- [ ] Configure real PSP provider and `PAYMENT_WEBHOOK_SECRET`.
- [ ] Configure `DATABASE_URL`, `STORAGE_BACKEND=s3`, `S3_BUCKET`.
- [ ] Configure webhook password-reset delivery and HTTPS URL.
- [ ] Configure production CORS origins and `METRICS_TOKEN`.
- [ ] Store Android release keystore as `ANDROID_RELEASE_KEYSTORE_B64`.
- [ ] Run the manual `HOPE Production Release` workflow with confirmation `RELEASE`.
- [ ] Validate signed APK on a physical Android device before rollout.


## Engineering baseline
- [ ] Repository/version metadata is aligned to 4.0.20+19 / Android versionCode 17.
- [ ] README, release checklist, CI workflow documentation, and changelog no longer contradict the current repository state.
- [ ] Backend package-lock is current and `npm ci` succeeds.
- [ ] `npm run check:all` passes.
- [ ] API route/contract checks pass.
- [ ] Security and production hardening contract tests pass.
- [ ] OpenAPI/API contract source and documented routes are synchronized where applicable.
- [ ] No unresolved Critical/High release findings remain.

## Current release blockers
- [ ] Real PSP adapter and sandbox verification.
- [ ] Real FCM/APNs push registration and delivery verification.
- [ ] Real email provider delivery verification.
- [ ] Real S3 integration against staging.
- [ ] Analytics event pipeline and product funnel dashboards.
- [ ] Crash/error telemetry and alerting.
- [ ] Staging environment with PostgreSQL, S3, notifications, payment sandbox, and monitoring.
- [ ] Physical Android device QA across low/mid/high-tier devices.


## Release candidate security gates
- [ ] Release APK is never debug-signed; Gradle fails closed when release keystore variables are absent.
- [ ] HMAC webhook verification is timing-safe and duplicate events remain idempotent under concurrent delivery.
- [ ] `npm run check:all` passes from a clean checkout.
- [ ] `npm run test:perf` passes for the current health smoke target.
- [ ] `npm audit --audit-level=high` succeeds with network access (offline audit is not a substitute).
- [ ] Flutter analyze/widget/integration tests pass with the actual Flutter SDK.
- [ ] Signed release APK installs and runs on physical Android devices.
- [ ] Load/soak results meet the documented P95/P99 targets.
- [ ] External PSP, push, email, S3 and staging environments are verified end-to-end.
- [ ] Independent security review / penetration test completed before public launch.

## Android device certification

- [ ] Android emulator workflow green for the release commit
- [ ] Staging `/api/v1/live` reachable over HTTPS from the emulator
- [ ] Physical-device smoke completed for the supported minimum Android profile

## Canonical configuration / release contract
- [ ] `cd backend && npm run check:config-contract` passes.
- [ ] Production workflow is dispatched from tag `v<pubspec version>` and the tag resolves to `GITHUB_SHA`.
- [ ] Production artifact name is exactly `artifacts/HOPE-<pubspec version>-production.apk`.
- [ ] APK SHA-256 sidecar and `release-manifest.json` are published together.
- [ ] Release manifest identifies application version, Android package/version, and build toolchain evidence.
- [ ] Historical reports are treated as immutable evidence and never as a substitute for current gate output.
