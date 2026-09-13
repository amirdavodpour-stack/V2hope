# HOPE Marketplace

A two-sided work marketplace: buyers post jobs, providers submit offers,
and a payment-hold/release flow settles the job once evidence is accepted.

- `backend/` — Node.js HTTP API (no framework), PostgreSQL-backed in
  staging/production, with an isolated test adapter for offline tests and
  legacy JSON retained only as migration input. See
  `backend/README.md`.
- `lib/` — Flutter mobile client (RTL, Material 3).
- `android/` — Android build configuration for the Flutter app.
- `test/`, `integration_test/` — Flutter unit/widget/integration tests.
- `tools/` — release helper scripts (`build_apk_release.sh`,
  `static_audit.sh`).
- `data/` — local JSON datastore used by the backend when `DATABASE_URL`
  is not set.

## What's implemented

**Backend routes** (`backend/src/app.js`): auth (register, login, logout,
refresh, password-reset request/confirm), provider profile, categories,
jobs (create, publish, list, detail, "mine"), offers (create, accept),
job execution transitions (start, deliver, accept-delivery, evidence),
payments (fund, release, status), and file upload (multipart, presigned
S3, and completion-verified direct upload).

**Mobile app** (`lib/`): guest browsing, login/register/password reset,
job listing/detail/create, offers, the full transaction lifecycle UI
(fund → start → evidence → deliver → accept → settlement), profile,
secure token storage with automatic access-token refresh, and an upload
retry queue.

There is no separate web client in this repository. The current release
scope is the Flutter mobile client plus the hardened API and its protected
admin/operations surfaces.

## Not implemented / known limitations

- **Payments are simulated only for local/test development.** Staging/production
  require `PAYMENT_PROVIDER=webhook` plus a real or sandbox PSP adapter.
  Production configuration rejects the simulator.
- **External notifications are provider-bound but not bundled.** Push and
  email delivery require configured HTTPS provider endpoints; in-app
  notifications work without them. A real FCM/APNs registration layer is not
  included yet.
- **Observability is currently first-party and in-process.** Funnel metrics,
  crash/error ingestion and health telemetry exist, but centralized metrics,
  external alert delivery and distributed tracing still require deployment
  integrations.
- **External operations integrations remain environment-dependent.** Real PSP,
  FCM/APNs, email and S3 end-to-end validation must be completed in staging.

## Repository layout

- `backend/` — API, persistence, workers, migrations, and backend tests.
- `lib/`, `test/`, `integration_test/`, `android/` — Flutter client and Android runtime.
- `tools/` — local validation, staging, release, and certification utilities.
- `.github/workflows/` — CI, staging, device, DR, and production release gates.
- `docs/` — technical references for architecture, API, database, internationalization, profiling, and supply-chain controls.

## Quick start

Backend:

```bash
cd backend
cp .env.example .env
npm run migrate
node src/server.js
```

Migration status / rollback tooling:

```bash
npm run migrate:status
npm run migrate:down
npm run check:migrations
```

Database migrations are numbered, checksum-protected, transaction-wrapped, and guarded by a PostgreSQL advisory lock. See `docs/DATABASE-MIGRATIONS.md`.

Mobile app, pointed at a local backend on an Android emulator:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

Release APK:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```

Build/signing details, including the Flutter/Android toolchain versions
this repo targets, are in `android/ANDROID-CONFIG.md`,
`android/README-API-CONFIG.md`, and `tools/build_apk_release.sh`.
Production release signing is intentionally fail-closed: this repository
does not contain a production keystore, and pilot/local builds made with
a non-production keystore must never be treated as store-ready
artifacts.

## Architecture

The backend keeps `app.js` as the HTTP composition root while cross-cutting validation and session policy live in dedicated modules under `backend/src/policies/` and `backend/src/services/`. PostgreSQL row-to-domain mapping is isolated in `backend/src/repository/mappers.js`; this keeps SQL orchestration separate from API/domain shape conversion and creates explicit seams for the next decomposition waves.

## Project references

Operational references: `SECURITY-THREAT-MODEL.md`, `AUTHORIZATION-MATRIX.md`, `DISASTER-RECOVERY.md`, `RELEASE-CHECKLIST.md`, and `RELEASE-VALIDATION.md`.

## CI / APK builds

The repository contains two GitHub Actions workflows:

- `.github/workflows/main.yml` runs backend quality gates, Flutter analyze/test,
  HTTPS API configuration validation, and a release-mode APK build on pushes
  to `main`/`master` or manual dispatch.
- `.github/workflows/production-release.yml` is a manually confirmed,
  fail-closed production APK workflow. It requires a real production HTTPS
  endpoint and release keystore secrets.

The workflows intentionally do not contain production credentials or a
keystore. Secrets must be supplied by the repository/environment owner.

## Fastest path to a working build

- Deploy the backend on **Koyeb** from GitHub using the existing Dockerfile in `backend/`
- Use **Neon** for Postgres
- Use **Cloudflare R2** for uploads
- Set the GitHub repository variable or secret `API_BASE_URL` to your deployed API URL, for example:
  `https://YOUR-KOYEB-SERVICE.koyeb.app/api/v1`

The build-test APK workflow now accepts `API_BASE_URL` from a repository variable too, so once the backend URL exists, a plain GitHub Actions build can produce a usable APK without editing the source tree. See `backend/DEPLOY-KOYEB-NEON-R2.md`.

## Financial engine
HOPE now exposes a transactional financial model around each payment. The advertised amount is the economic base; the API returns the employer charge, platform fee and provider payout explicitly. Mission fees are 10% on the employer side and 10% on the worker side. Job fees are 30% of the first-month salary on the employer side. A double-entry style ledger, settlement record, refund lifecycle and signed webhook boundary are included. The bundled payment provider is still a simulator; a production PSP adapter must implement the provider boundary without bypassing the ledger/state machine.


## Notification & Event System

HOPE now has durable in-app notifications backed by the outbox. Push and email delivery are configurable through `NOTIFICATION_PUSH_URL` and `NOTIFICATION_EMAIL_URL`; when those providers are not configured, in-app notifications still work and external delivery is recorded as not configured rather than silently failing.

## Privacy & Recommendation Quality

The application includes production-oriented privacy controls and recommendation quality safeguards.

### Account privacy API
- `GET /api/v1/account/export` — authenticated data export containing the account, provider, jobs, applications, offers, payments (credential fields removed), notifications and preferences.
- `POST /api/v1/account/delete` — authenticated irreversible privacy deletion. Requires JSON `{ "confirmation": "DELETE" }`. Authentication/session material and analytics/crash telemetry are removed; the account is anonymized and marked `DELETED`. Financially relevant records are preserved where referential integrity requires them.

### Telemetry consent
Mobile telemetry is now opt-in by default. The Flutter telemetry service exposes `telemetryConsent` and `setTelemetryConsent(bool)`; disabling consent also removes the local anonymous telemetry identifier.

### Recommendation quality
Recommendation scoring now applies freshness decay and category diversity penalties while preserving the existing eight public component scores and API shape. Ranking is deterministic after score ties.

## Architecture

The project uses a modular-monolith boundary between presentation, application/use-cases, domain/policy, repositories and infrastructure adapters. See `docs/ARCHITECTURE-LAYERS.md` for the dependency direction and migration policy.
