# Disaster Recovery

## Recovery objectives
- RPO target: 24h minimum with daily PostgreSQL logical backups; production may tighten this using WAL/PITR.
- RTO target: 60 minutes for API/database restoration.

## Procedure
1. Stop writes or place API behind maintenance protection.
2. Validate the archive with `backend/scripts/verify-backup.sh <backup.dump>` before restore.
3. Restore the latest verified `pg_dump` with `backend/scripts/restore.sh` into a clean PostgreSQL instance.
4. Run `npm run migrate` to apply forward-compatible schema changes.
5. Validate `/live`, `/health`, and `/ready`.
6. Validate outbox pending/failed events and re-enable workers.
7. Reattach S3 credentials/bucket and verify object access.

## Verification
Run `backend/scripts/dr-restore-drill.sh` against a non-production isolated database on a defined cadence. Backups must be tested periodically in an isolated database, with dated restore evidence retained; a backup file existing on disk is not considered proof of recoverability.
