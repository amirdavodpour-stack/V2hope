#!/usr/bin/env bash
# Fails the build if `flutter pub get` changed pubspec.lock, or if pubspec.lock
# is missing an entry for a package declared directly in pubspec.yaml.
#
# Why this exists: a prior release shipped with `shared_preferences` and
# `geolocator` added to pubspec.yaml but pubspec.lock was never regenerated,
# so the committed lock file silently stopped guaranteeing reproducible
# dependency versions for those packages. `flutter pub get` resolves it
# quietly, which is exactly why the drift went unnoticed. This check makes
# that class of bug loud instead of silent.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f pubspec.lock ]; then
  echo "pubspec.lock is missing." >&2
  exit 1
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --exit-code -- pubspec.lock; then
    echo >&2
    echo "pubspec.lock changed after 'flutter pub get'." >&2
    echo "Run 'flutter pub get' locally and commit the updated pubspec.lock." >&2
    exit 1
  fi
else
  echo "Not a git checkout; skipping git diff check for pubspec.lock." >&2
fi

# A committed lockfile must never pin dependencies to a session-local registry.
# Such URLs can exist only in a developer sandbox via PUB_HOSTED_URL; they are
# not reproducible inputs for CI or release builds.
if grep -nEq 'url: "http://(127\.0\.0\.1|localhost):[0-9]+"' pubspec.lock; then
  echo "pubspec.lock contains a session-local package registry URL." >&2
  echo "Regenerate with the normal hosted registry and commit the resulting lockfile." >&2
  exit 1
fi

# Belt-and-suspenders: every direct, pub.dev-hosted dependency in
# pubspec.yaml must have an entry in pubspec.lock. SDK dependencies
# (flutter, flutter_localizations, flutter_test, integration_test — anything
# declared as `sdk: flutter`) never get a packages: entry in pubspec.lock,
# so they're correctly excluded here rather than hardcoded by name.
missing=0
while IFS= read -r name; do
  if ! grep -qE "^  ${name}:\$" pubspec.lock; then
    echo "pubspec.lock has no entry for direct dependency '$name' declared in pubspec.yaml." >&2
    missing=1
  fi
done < <(awk '
  /^(dependencies|dev_dependencies):[[:space:]]*$/ { in_deps=1; next }
  /^[^[:space:]]/ { in_deps=0 }
  in_deps && /^  [A-Za-z0-9_]+:/ {
    if (pkg != "" && !is_sdk) print pkg
    line = $0
    sub(/^  /, "", line)
    sub(/:.*/, "", line)
    pkg = line
    is_sdk = 0
    next
  }
  in_deps && /^    sdk:/ { is_sdk = 1 }
  END { if (pkg != "" && !is_sdk) print pkg }
' pubspec.yaml)

if [ "$missing" = "1" ]; then
  echo "Run 'flutter pub get' locally and commit the updated pubspec.lock." >&2
  exit 1
fi

echo "pubspec.lock is up to date with pubspec.yaml."
