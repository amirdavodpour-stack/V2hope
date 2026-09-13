#!/usr/bin/env bash
# reproduce_flutter_evidence.sh
#
# Regenerates flutter-analyze and flutter-test evidence logs, in the same
# format/location as the existing TEST-EVIDENCE/*.log files, so a fresh run
# can be diffed line-by-line against the ones already committed.
#
# Must be run from hope_project/ on a machine with a real Flutter SDK
# (>=3.47.0 per pubspec.yaml) and network access for `flutter pub get`.
#
# Usage:
#   bash tools/reproduce_flutter_evidence.sh
#
# Exit code is non-zero if either gate fails, matching CI behaviour.

set -uo pipefail

if ! command -v flutter >/dev/null 2>&1; then
  echo "ERROR: flutter not found on PATH. Install Flutter >=3.47.0 first." >&2
  exit 127
fi

DATE_TAG="$(date +%F)"
OUT_DIR="TEST-EVIDENCE"
mkdir -p "$OUT_DIR"

ANALYZE_LOG="$OUT_DIR/flutter-analyze-${DATE_TAG}-reproduced.log"
TEST_LOG="$OUT_DIR/flutter-test-${DATE_TAG}-reproduced.log"

FLUTTER_VERSION="$(flutter --version | head -1)"

{
  echo "# flutter analyze — REPRODUCED RUN"
  echo "# command: flutter analyze"
  echo "# date: ${DATE_TAG}"
  echo "# flutter: ${FLUTTER_VERSION}"
  echo "################################################"
} > "$ANALYZE_LOG"

flutter pub get >> "$ANALYZE_LOG" 2>&1
flutter analyze >> "$ANALYZE_LOG" 2>&1
ANALYZE_EXIT=$?
echo "# exit code: ${ANALYZE_EXIT}" >> "$ANALYZE_LOG"

{
  echo "# flutter test --no-pub — REPRODUCED RUN"
  echo "# command: flutter test --no-pub"
  echo "# date: ${DATE_TAG}"
  echo "# flutter: ${FLUTTER_VERSION}"
  echo "################################################"
} > "$TEST_LOG"

flutter test --no-pub >> "$TEST_LOG" 2>&1
TEST_EXIT=$?
echo "# exit code: ${TEST_EXIT}" >> "$TEST_LOG"

echo ""
echo "=================================================="
echo "flutter analyze exit code: ${ANALYZE_EXIT}  (log: ${ANALYZE_LOG})"
echo "flutter test    exit code: ${TEST_EXIT}  (log: ${TEST_LOG})"
echo "=================================================="
echo ""
echo "Compare against the previously committed logs:"
echo "  diff ${ANALYZE_LOG} ${OUT_DIR}/flutter-analyze-2026-09-05.log"
echo "  diff ${TEST_LOG} ${OUT_DIR}/flutter-test-2026-09-05.log"
echo ""
echo "For a fully independent gate, prefer running this inside CI"
echo "(.github/workflows/main.yml already does this on every push) and"
echo "cite the GitHub Actions run URL instead of a locally produced log."

if [ "${ANALYZE_EXIT}" -ne 0 ] || [ "${TEST_EXIT}" -ne 0 ]; then
  exit 1
fi
exit 0
