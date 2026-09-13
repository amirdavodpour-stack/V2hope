# HOPE Database Migration Policy

The PostgreSQL schema is maintained through immutable, sequential migrations in `backend/src/db/migrations/`.

## Commands

```bash
cd backend
npm run migrate
npm run migrate:status
npm run migrate:down
npm run check:migrations
```

`migrate` applies every pending migration in version order. Each migration runs inside its own PostgreSQL transaction and is protected by a PostgreSQL advisory lock so two application/release processes cannot migrate concurrently.

`migrate:status` reports `pending`, `applied`, or `drifted`. The runner stores a SHA-256 checksum for the migration module. Changing an already-applied migration is therefore detected and blocks further migration work until the drift is explicitly resolved.

`001_initial_schema` is the immutable baseline for the existing HOPE relational schema and intentionally refuses destructive automatic rollback. Later migrations may provide a transactional `down` implementation where rollback is safe and reversible.

Production releases must run the migration gate before serving application traffic. Database backups and restore drills remain the recovery mechanism for destructive or irreversible changes.
