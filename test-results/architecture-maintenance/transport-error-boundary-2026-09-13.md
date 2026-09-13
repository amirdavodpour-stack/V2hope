# Architecture Maintenance — Transport Error Boundary

Date: 2026-09-13

## Change
Introduced `backend/src/api/http_error.js` as the single error class definition and re-exported it from `backend/src/http.js` for compatibility.

Moved non-HTTP layers away from importing the HTTP transport module: application geo/payment policy, validation/attributes policies, and session service now import the shared error contract directly.

## Verification
- `node --check` passed for all `backend/src/**/*.js` files.
- `npm run test:architecture-layers` passed: 3/3.
- Focused `npm run test:contract -- --test-name-pattern=...` passed: 72/72 tests executed in the contract command, including the new transport-boundary contract.
- Static scan confirms no `backend/src/application`, `backend/src/domain`, `backend/src/infrastructure`, `backend/src/policies`, or `backend/src/services` module imports `http.js`.

## Non-goals
No HTTP response schema, route contract, business rule, persistence behavior, or production runtime requirement was changed.
