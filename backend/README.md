# HOPE API

Backend matching the current Flutter client contract.

## Run locally

```bash
cp .env.example .env
node src/migrate.js
node src/server.js
```

Health: `GET http://localhost:3000/api/v1/health`

Set the Flutter base URL for an Android emulator:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

## Implemented modules

Auth (register/login/logout/refresh/password-reset), provider profile,
categories, jobs, offers + acceptance, funding, execution state transitions,
evidence metadata, multipart file upload, payment release/settlement, audit
trail, security headers/CORS, and upload limits.

## State machine

`DRAFT -> PUBLISHED -> ASSIGNED -> FUNDED -> IN_PROGRESS -> DELIVERED -> COMPLETED -> SETTLED`

Payment state: `HELD -> RELEASE_PENDING -> RELEASED`; terminal provider failures use `RELEASE_FAILED -> RELEASE_PENDING` for controlled retry.

For compatibility with the current mobile UI, `POST /payments/fund/:jobId`
selects the lowest pending offer when the job has not yet been assigned.
A future client can call `POST /offers/:offerId/accept` explicitly before
funding instead.

## Persistence architecture

- **Production, staging, and normal runtime** — PostgreSQL is mandatory and is
  the sole persistence authority. The application never hydrates a mutable
  in-memory snapshot from PostgreSQL and never flushes application state back
  to SQL. Repository modules perform reads and writes directly against the
  database, so horizontally scaled instances share one source of truth.
- **`NODE_ENV=test` without `DATABASE_URL`** — a deliberately isolated in-memory
  test adapter may be used for fast offline tests. It is not a deployment mode
  and cannot start outside the explicit test runtime.
- **Legacy JSON (`data/hope.json`)** is migration input only. It is not loaded by
  the PostgreSQL runtime and is never used as a production fallback.

All production routes resolve users, jobs, offers, payments, uploads, and
tokens through `src/repository.js`. Critical mutations use SQL transactions
and row-level locking where required.

For compatibility with the current mobile UI, `POST /payments/fund/:jobId`
selects the lowest pending offer when the job has not yet been assigned. A
future client can call `POST /offers/:offerId/accept` explicitly before funding
instead.

## Security

Passwords use PBKDF2-SHA256 (async, non-blocking); access tokens are
short-lived signed HMAC tokens; refresh tokens are random, hashed, rotated,
and revoked on reuse (session-family revocation); production secrets are
mandatory (`config.js` refuses to boot with placeholder secrets when
`NODE_ENV=production`); upload size and content-type/signature are
validated. See `SECURITY-THREAT-MODEL.md`.

## Payments

`PAYMENT_PROVIDER=webhook` is required in staging/production and must point
to a real/sandbox PSP adapter. `simulator` is for isolated local/test use only.
The payment adapter interface is documented in `src/payment_provider.js`; live
transactions require a real provider plus external staging certification.

## Operations

- `GET /health` and `GET /api/v1/health` expose database status.
- `GET /metrics` exposes lightweight request/route counters (requires
  `X-Metrics-Token` when `METRICS_TOKEN` is set).
- `X-Request-Id` is returned on every response.
- `scripts/backup.sh` / `scripts/restore.sh` wrap `pg_dump`/`pg_restore`.
- Set `STORAGE_BACKEND=s3` with `S3_BUCKET`/`S3_REGION`/`S3_ENDPOINT` for
  S3-compatible object storage; `/storage/presign` + `/storage/complete`
  support direct-to-storage uploads with a server-side `HEAD` verification
  step before the upload is recorded.
- Password reset delivery is explicit: set `RESET_TOKEN_DELIVERY_MODE=webhook`
  and an HTTPS `RESET_TOKEN_DELIVERY_URL`; also set `RESET_TOKEN_DELIVERY_SECRET`
  (32+ chars). Delivery requests are HMAC-signed with timestamp/event-id headers.
  Payment webhooks likewise require timestamped HMAC signatures within the replay window.

## Test execution modes (two-mode contract)

- Offline legacy suites (`test:offline`, `test:fast`, `test:contract`,
  `test:backup`, and the other contract suites) must run WITHOUT
  `DATABASE_URL`. Under `NODE_ENV=test` without `DATABASE_URL`, `src/db.js`
  uses the deliberately isolated in-memory test adapter.
- `npm run test:postgres` requires `DATABASE_URL` and a FRESH database; it
  exercises the real PostgreSQL repository path.
- The combination "legacy suite + `DATABASE_URL`" is unsupported by design:
  `src/db.js` disables the in-memory legacy adapter under a SQL runtime
  (`allowLegacyRuntime = isTestRuntime && !isPostgresRuntime`), so most
  legacy tests intentionally fail there (finding F3, Session 006). A
  warn-only guard (`tools/guard-legacy-test-env.mjs`, wired as the
  `pretest:offline` hook) prints this contract whenever `DATABASE_URL` is
  set during `test:offline`.

## Validation gates

`npm run check && npm test` (see `package.json` for the full script list).
CI must additionally run the Flutter `analyze`/`test`/build jobs against
the same commit. See `docs/CONFIGURATION-CONTRACT.md`,
`RELEASE-VALIDATION.md`, and `RELEASE-CHECKLIST.md` for the authoritative
release contract.
