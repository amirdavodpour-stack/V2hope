#!/usr/bin/env sh
set -eu

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${DRILL_DATABASE_URL:?DRILL_DATABASE_URL is required}"

[ "$SOURCE_DATABASE_URL" != "$DRILL_DATABASE_URL" ] || { echo "SOURCE_DATABASE_URL and DRILL_DATABASE_URL must be different isolated targets." >&2; exit 1; }

command -v pg_dump >/dev/null 2>&1 || { echo 'pg_dump is required' >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo 'pg_restore is required' >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo 'psql is required' >&2; exit 1; }

WORK_DIR="${DRILL_WORK_DIR:-$(mktemp -d)}"
mkdir -p "$WORK_DIR"
trap 'rm -f "$WORK_DIR/restore-drill.dump"' EXIT

DUMP="$WORK_DIR/restore-drill.dump"
EVIDENCE="${DRILL_EVIDENCE_FILE:-$WORK_DIR/restore-evidence.txt}"

START_EPOCH="$(date +%s)"
START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo '== PostgreSQL backup =='
BACKUP_START="$(date +%s)"
pg_dump "$SOURCE_DATABASE_URL" --format=custom --file="$DUMP"
"$(dirname "$0")/verify-backup.sh" "$DUMP"
BACKUP_END="$(date +%s)"
BACKUP_SECONDS=$((BACKUP_END-BACKUP_START))

echo '== Isolated restore =='
RESTORE_START="$(date +%s)"
pg_restore --exit-on-error --clean --if-exists --no-owner --dbname="$DRILL_DATABASE_URL" "$DUMP"

RESTORE_END="$(date +%s)"
RESTORE_SECONDS=$((RESTORE_END-RESTORE_START))
TOTAL_SECONDS=$((RESTORE_END-START_EPOCH))
RTO_TARGET_SECONDS="${RTO_TARGET_SECONDS:-900}"
[ "$TOTAL_SECONDS" -le "$RTO_TARGET_SECONDS" ] || { echo "RTO target exceeded: ${TOTAL_SECONDS}s > ${RTO_TARGET_SECONDS}s" >&2; exit 1; }

count="$(psql "$DRILL_DATABASE_URL" -Atqc "select count(*) from information_schema.tables where table_schema='public';")"
[ "${count:-0}" -ge 15 ] || { echo "Unexpected public table count: $count" >&2; exit 1; }

users="$(psql "$DRILL_DATABASE_URL" -Atqc 'select count(*) from users;')"
categories="$(psql "$DRILL_DATABASE_URL" -Atqc 'select count(*) from categories;')"
required="users,categories,jobs,offers,payments,outbox_events"
for table in $(printf '%s' "$required" | tr ',' ' '); do
  exists="$(psql "$DRILL_DATABASE_URL" -Atqc "select to_regclass('public.' || '$table') is not null;")"
  [ "$exists" = "t" ] || { echo "Missing required table after restore: $table" >&2; exit 1; }
done
psql "$DRILL_DATABASE_URL" -Atqc 'select 1;' >/dev/null

cat > "$EVIDENCE" <<EOF
HOPE DR restore drill
Started UTC: $START_ISO
Completed UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Backup seconds: $BACKUP_SECONDS
Restore seconds: $RESTORE_SECONDS
Total RTO seconds: $TOTAL_SECONDS
RTO target seconds: $RTO_TARGET_SECONDS
Public tables: $count
Users rows: $users
Categories rows: $categories
Result: PASS
EOF

printf '%s\n' "DR restore drill PASS: evidence=$EVIDENCE"
