#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

printf '%s\n' '=== HOPE AGENT PREFLIGHT ==='
printf 'repo=%s\n' "$ROOT"
printf 'timestamp_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'shell=%s\n' "$BASH_VERSION"

bash tools/ci-resource-guard.sh

check_file() {
  [ -e "$1" ] || { echo "AGENT_PREFLIGHT_FAIL: missing $1" >&2; exit 3; }
  printf 'present\t%s\n' "$1"
}

for f in \
  pubspec.yaml pubspec.lock \
  backend/package.json backend/package-lock.json \
  android/gradlew \
  tools/runtime-certification-preflight.sh \
  tools/android-build-preflight.sh \
  tools/build_apk_debug.sh \
  .github/workflows/staging-certification.yml; do
  check_file "$f"
done

# Version contracts are machine-checkable and must agree before expensive work.
EXPECTED_NODE=24
EXPECTED_JAVA=17
EXPECTED_FLUTTER=3.47.2

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  printf 'node_major\t%s\n' "$NODE_MAJOR"
  [ "$NODE_MAJOR" = "$EXPECTED_NODE" ] || { echo "AGENT_PREFLIGHT_BLOCK: Node $EXPECTED_NODE required; found $NODE_MAJOR." >&2; exit 4; }
else
  echo 'AGENT_PREFLIGHT_BLOCK: node not installed.' >&2; exit 4
fi

if command -v java >/dev/null 2>&1; then
  JAVA_MAJOR="$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\)\..*/\1/p' | head -1)"
  printf 'java_major\t%s\n' "$JAVA_MAJOR"
  [ "$JAVA_MAJOR" = "$EXPECTED_JAVA" ] || { echo "AGENT_PREFLIGHT_BLOCK: Java $EXPECTED_JAVA required; found $JAVA_MAJOR." >&2; exit 4; }
else
  echo 'AGENT_PREFLIGHT_BLOCK: java not installed.' >&2; exit 4
fi

if command -v flutter >/dev/null 2>&1; then
  FLUTTER_VERSION="$(flutter --version 2>/dev/null | sed -n '1s/Flutter \([^ ]*\).*/\1/p')"
  printf 'flutter_version\t%s\n' "$FLUTTER_VERSION"
  [ "$FLUTTER_VERSION" = "$EXPECTED_FLUTTER" ] || { echo "AGENT_PREFLIGHT_BLOCK: Flutter $EXPECTED_FLUTTER required; found ${FLUTTER_VERSION:-unknown}." >&2; exit 4; }
else
  echo 'AGENT_PREFLIGHT_BLOCK: Flutter not installed.' >&2; exit 4
fi

printf '%s\n' 'AGENT_PREFLIGHT_PASS'
