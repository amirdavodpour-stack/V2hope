#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Non-runtime Flutter suite. This never invokes an Android release build.
printf '%s\n' '=== HOPE Flutter unit/widget suite ==='
flutter test

# Runtime suite: requires a connected Flutter-capable Android/iOS device or emulator.
# It intentionally targets integration_test only and never calls a release APK task.
printf '%s\n' '=== HOPE Flutter runtime integration suite ==='
flutter test integration_test/runtime

printf '%s\n' '=== HOPE Flutter test suite completed ==='
