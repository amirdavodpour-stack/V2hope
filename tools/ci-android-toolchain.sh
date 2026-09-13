#!/usr/bin/env bash
set -euo pipefail

# CI-only Android SDK bootstrap/verification for the certified mobile baseline.
# Keeps the runner's preinstalled SDK from being an implicit, undocumented input.
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [ -z "$ANDROID_SDK_ROOT" ]; then
  echo 'ERROR: ANDROID_SDK_ROOT/ANDROID_HOME is not set.' >&2
  exit 1
fi
export ANDROID_SDK_ROOT
export ANDROID_HOME="$ANDROID_SDK_ROOT"
if [ -n "${GITHUB_ENV:-}" ]; then
  printf 'ANDROID_SDK_ROOT=%s\nANDROID_HOME=%s\n' "$ANDROID_SDK_ROOT" "$ANDROID_SDK_ROOT" >> "$GITHUB_ENV"
fi

command -v java >/dev/null 2>&1 || { echo 'ERROR: Java is not installed.' >&2; exit 1; }
command -v javac >/dev/null 2>&1 || { echo 'ERROR: javac is not installed; full JDK required.' >&2; exit 1; }
JAVA_MAJOR="$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\)\..*/\1/p' | head -1)"
[ "$JAVA_MAJOR" = "17" ] || { echo "ERROR: Java 17 is required; found ${JAVA_MAJOR:-unknown}." >&2; exit 1; }

SDKMANAGER=''
for candidate in \
  "$(command -v sdkmanager 2>/dev/null || true)" \
  "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
  "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    SDKMANAGER="$candidate"
    break
  fi
done

if [ -z "$SDKMANAGER" ]; then
  echo 'ERROR: sdkmanager was not found in the configured Android SDK.' >&2
  exit 1
fi

export PATH="$(dirname "$SDKMANAGER"):$PATH"

yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
"$SDKMANAGER" --install \
  'platform-tools' \
  'platforms;android-36' \
  'build-tools;36.0.0' \
  'ndk;28.2.13676358'

EVIDENCE_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
mkdir -p "$EVIDENCE_DIR"
"$SDKMANAGER" --list_installed | tee "$EVIDENCE_DIR/hope-android-sdk-installed.txt" >/dev/null
for package in \
  'platform-tools' \
  'platforms;android-36' \
  'build-tools;36.0.0' \
  'ndk;28.2.13676358'; do
  grep -Fq "$package" "$EVIDENCE_DIR/hope-android-sdk-installed.txt" || {
    echo "ERROR: required Android package is not installed: $package" >&2
    exit 1
  }
done

java -version
printf '%s\n' 'Android CI toolchain: PASS'
