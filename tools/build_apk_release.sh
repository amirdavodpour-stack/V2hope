#!/usr/bin/env bash
set -euo pipefail

: "${API_BASE_URL:?Set API_BASE_URL, e.g. https://api.example.com/api/v1}"

case "$API_BASE_URL" in
  https://*) ;;
  *) echo 'ERROR: API_BASE_URL must use HTTPS for a release build.' >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

APP_VERSION="$(awk '/^version:[[:space:]]*/ {print $2; exit}' pubspec.yaml)"
VERSION_NAME="${APP_VERSION%%+*}"
VERSION_CODE="${APP_VERSION##*+}"
[[ "$APP_VERSION" == *+* ]] || { echo "ERROR: pubspec version must be name+code (got $APP_VERSION)." >&2; exit 1; }

BUILD_PROFILE="${BUILD_PROFILE:-pilot}"
case "$BUILD_PROFILE" in
  pilot|production) ;;
  *) echo 'ERROR: BUILD_PROFILE must be production or pilot.' >&2; exit 1 ;;
esac

# Pilot is the safe default for local/CI build helpers. Production must be explicit.
if [[ "$BUILD_PROFILE" == "production" ]]; then
  : "${ANDROID_RELEASE_STORE_FILE:?Set ANDROID_RELEASE_STORE_FILE for a production release}"
  : "${ANDROID_RELEASE_STORE_PASSWORD:?Set ANDROID_RELEASE_STORE_PASSWORD for a production release}"
  : "${ANDROID_RELEASE_KEY_ALIAS:?Set ANDROID_RELEASE_KEY_ALIAS for a production release}"
  : "${ANDROID_RELEASE_KEY_PASSWORD:?Set ANDROID_RELEASE_KEY_PASSWORD for a production release}"
fi

chmod +x android/gradlew
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$PWD/.gradle-release}"
export GRADLE_OPTS="${GRADLE_OPTS:--Dorg.gradle.daemon=false -Dorg.gradle.caching=false -Dorg.gradle.configuration-cache=false -Dorg.gradle.vfs.watch=false -Dorg.gradle.parallel=false}"
bash tools/android-build-preflight.sh
rm -rf build android/build android/app/build .gradle android/.gradle .dart_tool
rm -f android/local.properties .flutter-plugins-dependencies
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

# Encode Dart defines with portable base64 so pilot/production builds survive any
# whitespace or shell-metacharacter in supplied values across BSD/GNU coreutils.
# The single-line-wrap flag (BSD-incompatible) is intentionally avoided; we use
# `tr` to strip newlines instead, which works identically on macOS and Linux.
API_BASE_URL_B64="$(printf '%s' "$API_BASE_URL" | base64 | tr -d '\n')"
BUILD_PROFILE_B64="$(printf '%s' "$BUILD_PROFILE" | base64 | tr -d '\n')"

flutter build apk --release --no-pub \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=BUILD_PROFILE="$BUILD_PROFILE" \
  --dart-define=API_BASE_URL_B64="$API_BASE_URL_B64" \
  --dart-define=BUILD_PROFILE_B64="$BUILD_PROFILE_B64" \
  --verbose

mapfile -t APKS < <(
  find \
    android/app/build/outputs/apk \
    build/app/outputs/flutter-apk \
    -type f -name '*.apk' -print 2>/dev/null \
    | sort -u
)

if [[ "${#APKS[@]}" -eq 0 ]]; then
  echo 'ERROR: Gradle succeeded but no APK was discovered.' >&2
  find android/app/build/outputs build/app/outputs -maxdepth 5 -type f 2>/dev/null | sort >&2 || true
  exit 1
fi

APK=""
for candidate in "${APKS[@]}"; do
  if [[ "$candidate" == *"app-release.apk" ]]; then
    APK="$candidate"
    break
  fi
done
if [[ -z "$APK" ]]; then
  APK="${APKS[0]}"
fi

test -s "$APK"
SIZE="$(stat -c '%s' "$APK" 2>/dev/null || stat -f '%z' "$APK")"
test "$SIZE" -gt 1000000

EXPECTED_PACKAGE="com.hope.marketplace"
if [[ "$BUILD_PROFILE" == "pilot" ]]; then
  EXPECTED_PACKAGE="com.hope.marketplace.pilot"
fi

BADGING=''
if command -v aapt >/dev/null 2>&1; then
  BADGING="$(aapt dump badging "$APK")"
  grep -q "package: name='$EXPECTED_PACKAGE'" <<<"$BADGING" || { echo "ERROR: wrong applicationId; expected $EXPECTED_PACKAGE." >&2; exit 1; }
  grep -q "versionName='$VERSION_NAME'" <<<"$BADGING" || { echo "ERROR: unexpected versionName; expected $VERSION_NAME." >&2; exit 1; }
  grep -q "versionCode='$VERSION_CODE'" <<<"$BADGING" || { echo "ERROR: unexpected versionCode; expected $VERSION_CODE." >&2; exit 1; }
elif command -v apkanalyzer >/dev/null 2>&1; then
  test "$(apkanalyzer manifest application-id "$APK")" = "$EXPECTED_PACKAGE"
  test "$(apkanalyzer manifest version-name "$APK")" = "$VERSION_NAME"
  test "$(apkanalyzer manifest version-code "$APK")" = "$VERSION_CODE"
else
  echo 'ERROR: neither aapt nor apkanalyzer is available for APK metadata verification.' >&2
  exit 1
fi

if command -v apksigner >/dev/null 2>&1; then
  apksigner verify --verbose "$APK"
else
  echo 'ERROR: apksigner is required for release artifact verification.' >&2
  exit 1
fi

mkdir -p artifacts
CANONICAL="artifacts/HOPE-${APP_VERSION}-${BUILD_PROFILE}.apk"
cp "$APK" "$CANONICAL"

SHA256="$(sha256sum "$CANONICAL" | awk '{print $1}')"
printf '%s  %s\n' "$SHA256" "$(basename "$CANONICAL")" > artifacts/SHA256SUMS.txt
cat > artifacts/VERIFICATION.txt <<EOF
profile=$BUILD_PROFILE
source_apk=$APK
canonical_apk=$CANONICAL
package=$EXPECTED_PACKAGE
versionName=$VERSION_NAME
versionCode=$VERSION_CODE
size_bytes=$SIZE
sha256=$SHA256
EOF

printf '\nRelease artifact\n-----------------\n'
printf 'Profile: %s\n' "$BUILD_PROFILE"
printf 'APK: %s\n' "$CANONICAL"
printf 'Size: %s bytes\n' "$SIZE"
printf 'SHA-256: %s\n' "$SHA256"
printf 'Signature verification: PASS\n'
