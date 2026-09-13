#!/usr/bin/env sh
set -eu
: "${1:?backup file required}"
command -v pg_restore >/dev/null 2>&1 || { echo 'pg_restore is required' >&2; exit 1; }
[ -s "$1" ] || { echo 'backup file is missing or empty' >&2; exit 1; }
pg_restore --list "$1" >/dev/null
printf '%s\n' "Backup archive is structurally valid: $1"
