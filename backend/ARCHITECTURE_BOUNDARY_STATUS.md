# Persistence Boundary Status — 2026-09-13

## Current invariant
All HTTP route handlers under `backend/src/routes/` are forbidden from directly calling the persistence facade (`db.collection`, `db.insert`, `db.update`, `db.touch`, `db.save`).

## Validation
- Fast suite: 247/247 PASS
- Architecture layer contract: 4/4 PASS
- Backend JavaScript syntax: PASS
- Direct persistence-facade calls in route layer: 0
- Auth/security E2E targeted suite: 5/5 PASS

## Legacy runtime
Legacy file-mode persistence remains available only through explicit adapters under `backend/src/application/legacy/` for `NODE_ENV=test` compatibility. PostgreSQL remains the production persistence authority.
