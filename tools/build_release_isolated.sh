#!/usr/bin/env bash
set -euo pipefail

# Build from a disposable copy so test-only integration_test dependencies can
# never contaminate the release GeneratedPluginRegistrant.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="${RUNNER_TEMP:-$ROOT_DIR/.tmp}/hope-release-$$"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$(dirname "$TMP_DIR")"
cp -a "$ROOT_DIR" "$TMP_DIR"

cd "$TMP_DIR"
rm -rf .git .gradle android/.gradle build android/build android/app/build

# Never let an isolated pilot invocation accidentally become a production build.
export BUILD_PROFILE="${BUILD_PROFILE:-pilot}"

python3 - <<'PY'
from pathlib import Path
p = Path('pubspec.yaml')
lines = p.read_text(encoding='utf-8').splitlines()
out = []
in_dev = False
skip = False
removed = False
for line in lines:
    stripped = line.strip()
    if line.startswith('dev_dependencies:'):
        in_dev = True
        out.append(line)
        continue
    if in_dev and line and not line.startswith((' ', '\t')):
        in_dev = False
    if in_dev and stripped == 'integration_test:':
        removed = True
        skip = True
        continue
    if in_dev and skip and stripped == 'sdk: flutter':
        skip = False
        continue
    if in_dev and skip:
        skip = False
    out.append(line)
if not removed:
    raise SystemExit('ERROR: integration_test dependency was not found under dev_dependencies')
p.write_text('\n'.join(out) + '\n', encoding='utf-8')
PY

rm -f android/app/src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.java
flutter pub get --enforce-lockfile
flutter gen-l10n

if grep -RInE 'integration_test|IntegrationTestPlugin' android/app/src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.* 2>/dev/null; then
  echo 'ERROR: release copy still contains integration_test registration.' >&2
  exit 1
fi

export HOPE_RELEASE_ISOLATED=1
./tools/build_apk_release.sh

rm -rf "$ROOT_DIR/artifacts"
cp -a artifacts "$ROOT_DIR/artifacts"
