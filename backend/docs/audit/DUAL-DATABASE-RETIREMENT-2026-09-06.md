# Dual Database Architecture Retirement — 2026-09-06

## Outcome

The production persistence architecture no longer operates as `PostgreSQL + in-memory/file state`.

### Production / staging / normal runtime
- PostgreSQL is mandatory outside the explicit `NODE_ENV=test` runtime.
- PostgreSQL is the sole persistence authority.
- The application does not hydrate a mutable application snapshot from PostgreSQL.
- The application does not flush in-memory collections back into PostgreSQL.
- `db.collection`, `db.insert`, `db.update`, `db.touch`, and `db.reset` are rejected outside the explicit test runtime.
- Legacy filesystem modules are dynamically loaded only for an offline test process without PostgreSQL.

### Test runtime
- Offline tests may use the legacy in-memory/file adapter for fast deterministic tests.
- PostgreSQL-backed integration tests still run under `NODE_ENV=test` when `DATABASE_URL` is supplied.

## Migration boundary

`backend/data/hope.json` is migration input only. PostgreSQL initialization no longer reads it or copies it into relational tables. Seeding is performed directly against PostgreSQL in SQL mode.

## Validation

- `npm test`: 480 total, 475 passed, 0 failed, 5 skipped.
- `npm run check:all`: 22/22 passed.
- Persistence architecture contract: 5/5 passed.

## Runtime limitation

No live PostgreSQL service is available in the current execution environment, so the PostgreSQL integration tests remain skipped here. The production guard and architecture contracts prevent silent fallback to the legacy store.
