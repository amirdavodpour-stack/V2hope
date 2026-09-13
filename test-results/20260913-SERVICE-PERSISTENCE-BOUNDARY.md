# Persistence Boundary Hardening — 2026-09-13

## Scope
- Added `application/legacy/app_legacy.js` to isolate composition-root legacy reads/mutations.
- Added `application/legacy/session_legacy.js` and removed direct persistence-facade calls from `services/session.js`.
- Removed direct persistence-facade calls from `application/view_helpers.js`; legacy audit insertion is now injected explicitly.
- `app.js` remains a composition root; its only `db` usage is initialization/transaction wiring and legacy-adapter construction.

## Validation
- `backend npm run test:fast`: 247/247 PASS.
- `backend npm run test:contract`: 83/83 PASS.
- `backend npm run test:architecture-layers`: 4/4 PASS.
- Backend JavaScript syntax: PASS for changed modules.
- Direct persistence calls in HTTP routes: 0.
- Non-legacy direct persistence calls remaining are limited to explicit compatibility/service modules (`analytics.js`, `notifications.js`, `payment_webhook.js`) plus initialization in `db.js`; these are the next isolation targets.

## Infrastructure limits
- Full certification/integration suites requiring PostgreSQL, S3/R2, staging, Android SDK/emulator, Docker, or CI evidence remain environment-blocked per `test-results/FAILURES-AND-BLOCKERS.md`.
