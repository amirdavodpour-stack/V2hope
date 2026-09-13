#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${API_BASE_URL:=https://staging.api.hope.app}"
case "$API_BASE_URL" in
  https://*) ;;
  *) echo 'ERROR: API_BASE_URL must use HTTPS for the certified debug build.' >&2; exit 1;;
esac

export BUILD_PROFILE="${BUILD_PROFILE:-pilot}"
[ "$BUILD_PROFILE" = "pilot" ] || { echo 'ERROR: debug certification uses BUILD_PROFILE=pilot.' >&2; exit 1; }

export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$ROOT/.gradle-debug}"
bash tools/ci-resource-guard.sh
export GRADLE_OPTS="${GRADLE_OPTS:--Dorg.gradle.daemon=false -Dorg.gradle.caching=false -Dorg.gradle.configuration-cache=false -Dorg.gradle.vfs.watch=false -Dorg.gradle.parallel=false}"
bash tools/android-build-preflight.sh

# Remove generated host-local metadata from packaged sources. Flutter recreates
# it during pub get for the current machine.
rm -f android/local.properties .flutter-plugins-dependencies
rm -rf build android/build android/app/build .dart_tool android/.gradle .gradle
flutter clean
flutter pub get --enforce-lockfile
[ -f android/local.properties ] || { echo 'ERROR: Flutter did not regenerate android/local.properties.' >&2; exit 1; }
FLUTTER_SDK_PATH="$(sed -n 's/^flutter\.sdk=//p' android/local.properties | head -1)"
ANDROID_SDK_PATH="$(sed -n 's/^sdk\.dir=//p' android/local.properties | head -1)"
[ -n "$FLUTTER_SDK_PATH" ] && [ -d "$FLUTTER_SDK_PATH" ] || { echo 'ERROR: generated flutter.sdk path is invalid.' >&2; exit 1; }
[ -n "$ANDROID_SDK_PATH" ] && [ -d "$ANDROID_SDK_PATH" ] || { echo 'ERROR: generated sdk.dir path is invalid.' >&2; exit 1; }
flutter gen-l10n
flutter analyze
flutter test --no-pub

flutter build apk --debug --no-pub \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=BUILD_PROFILE="$BUILD_PROFILE" \
  --verbose

APK="build/app/outputs/flutter-apk/app-debug.apk"
test -s "$APK" || { echo "ERROR: expected debug APK was not produced: $APK" >&2; find build/app/outputs/flutter-apk -maxdepth 1 -type f -print >&2 || true; exit 1; }
APK_SIZE="$(stat -c '%s' "$APK" 2>/dev/null || stat -f '%z' "$APK")"
test "$APK_SIZE" -gt 1000000 || { echo "ERROR: debug APK is implausibly small: $APK_SIZE bytes" >&2; exit 1; }

VERSION="$(awk '/^version:[[:space:]]*/ {print $2; exit}' pubspec.yaml)"
VERSION_NAME="${VERSION%%+*}"
VERSION_CODE="${VERSION##*+}"

if command -v aapt >/dev/null 2>&1; then
  BADGING="$(aapt dump badging "$APK")"
  grep -q "package: name='com.hope.marketplace'" <<<"$BADGING" || { echo 'ERROR: unexpected debug applicationId.' >&2; exit 1; }
  grep -q "versionName='$VERSION_NAME'" <<<"$BADGING" || { echo 'ERROR: unexpected debug versionName.' >&2; exit 1; }
  grep -q "versionCode='$VERSION_CODE'" <<<"$BADGING" || { echo 'ERROR: unexpected debug versionCode.' >&2; exit 1; }
elif command -v apkanalyzer >/dev/null 2>&1; then
  test "$(apkanalyzer manifest application-id "$APK")" = 'com.hope.marketplace'
  test "$(apkanalyzer manifest version-name "$APK")" = "$VERSION_NAME"
  test "$(apkanalyzer manifest version-code "$APK")" = "$VERSION_CODE"
else
  echo 'ERROR: aapt or apkanalyzer is required for debug APK verification.' >&2
  exit 1
fi

mkdir -p artifacts
CANONICAL="artifacts/HOPE-${VERSION}-debug.apk"
cp "$APK" "$CANONICAL"
SHA256="$(sha256sum "$CANONICAL" | awk '{print $1}')"
printf '%s  %s\n' "$SHA256" "$(basename "$CANONICAL")" > artifacts/SHA256SUMS.txt
cat > artifacts/DEBUG-VERIFICATION.txt <<EOF
profile=$BUILD_PROFILE
api_base_url=$API_BASE_URL
source_apk=$APK
canonical_apk=$CANONICAL
package=com.hope.marketplace
versionName=$VERSION_NAME
versionCode=$VERSION_CODE
size_bytes=$APK_SIZE
sha256=$SHA256
EOF

printf 'DEBUG_APK_BUILD_PASS\nAPK=%s\nSHA256=%s\n' "$CANONICAL" "$SHA256"
