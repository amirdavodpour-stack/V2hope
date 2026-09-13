#!/usr/bin/env bash
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"
GRADLE="android/app/build.gradle.kts"
NETWORK_CONFIG="android/app/src/main/res/xml/network_security_config.xml"

for file in "$MANIFEST" "$GRADLE" "$NETWORK_CONFIG"; do
  test -f "$file" || { echo "ERROR: missing Android release file: $file" >&2; exit 1; }
done

grep -q 'android:usesCleartextTraffic="false"' "$MANIFEST" || { echo 'ERROR: Android cleartext traffic must be disabled.' >&2; exit 1; }
grep -q 'android:networkSecurityConfig="@xml/network_security_config"' "$MANIFEST" || { echo 'ERROR: network security config is not wired.' >&2; exit 1; }
grep -q '<base-config cleartextTrafficPermitted="false"' "$NETWORK_CONFIG" || { echo 'ERROR: network security base config must deny cleartext.' >&2; exit 1; }
grep -q 'minSdk = 30' "$GRADLE" || { echo 'ERROR: minSdk drifted from certified baseline 30.' >&2; exit 1; }
grep -q 'targetSdk = 36' "$GRADLE" || { echo 'ERROR: targetSdk drifted from certified baseline 36.' >&2; exit 1; }
grep -q 'signingConfig = signingConfigs.getByName("debug")' "$GRADLE" || { echo 'ERROR: pilot must remain non-production signed.' >&2; exit 1; }
grep -Eq 'Production (builds require|release requires) ANDROID_RELEASE_STORE_FILE' "$GRADLE" || { echo 'ERROR: production signing guard missing.' >&2; exit 1; }
grep -q 'profile == "production"' "$GRADLE" || { echo 'ERROR: production release profile guard missing.' >&2; exit 1; }

if grep -RInE 'http://[^[:space:]" ]+' lib --exclude='*.md' >/tmp/hope-http-refs.txt 2>/dev/null; then
  if ! grep -Eq '10\.0\.2\.2:9|staging\.invalid' /tmp/hope-http-refs.txt; then
    echo 'ERROR: unexpected cleartext HTTP endpoint found in Flutter runtime sources:' >&2
    cat /tmp/hope-http-refs.txt >&2
    exit 1
  fi
fi


printf '%s\n' 'Android release contract: PASS'
