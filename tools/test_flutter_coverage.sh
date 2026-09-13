#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
flutter test --coverage
LCOV=coverage/lcov.info
test -s "$LCOV"
TOTAL_LINE=$(awk -F: '/^LF:/{lf+=$2} /^LH:/{lh+=$2} END{if(lf==0) exit 2; printf "%.2f", (lh*100)/lf}' "$LCOV")
THRESHOLD="${FLUTTER_LINE_COVERAGE_MIN:-65}"
awk -v actual="$TOTAL_LINE" -v min="$THRESHOLD" 'BEGIN { exit !(actual+0 >= min+0) }' || { echo "Flutter line coverage ${TOTAL_LINE}% is below required ${THRESHOLD}%" >&2; exit 1; }
echo "Flutter line coverage: ${TOTAL_LINE}% (minimum ${THRESHOLD}%)"
