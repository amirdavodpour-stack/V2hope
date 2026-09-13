# 2026-09-13 — Admin Persistence Boundary Wave

## Implemented
- Added `src/application/legacy/admin_legacy.js` as an explicit legacy/test-only adapter.
- Removed direct `db.collection` access from `src/routes/admin_routes.js`.
- Wired the adapter from `src/app.js` while production continues through PostgreSQL-backed admin use cases.
- Updated admin architecture contracts to protect the new boundary.

## Validation
- Admin + application-layer + persistence-boundary tests: 15/15 PASS.
- Full `npm run test:fast`: 247/247 PASS.
- Backend syntax checks for changed JS files: PASS.
- Route-level direct `db.collection` references: admin route reduced to 0.

## Remaining migration debt
Direct legacy references remain in other routes/application code. These are intentionally retained for the explicit test runtime until their corresponding repository/use-case ports are migrated and regression-tested.
