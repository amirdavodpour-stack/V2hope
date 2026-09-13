#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo '[1] Dart risky catches / prints'
grep -RInE 'catch \(_\)|print\(|debugPrint\(' lib || true

echo '[2] Android release signing'
grep -n 'signingConfig\|minSdk\|targetSdk\|compileSdk' android/app/build.gradle.kts
grep -Eq 'Production (builds require|release requires) ANDROID_RELEASE_STORE_FILE' android/app/build.gradle.kts || { echo 'ERROR: release signing guard missing' >&2; exit 1; }
if grep -q 'signingConfig = signingConfigs.getByName("debug")' android/app/build.gradle.kts && ! grep -q '"pilot"' android/app/build.gradle.kts; then echo 'ERROR: debug signing is not explicitly scoped to pilot builds' >&2; exit 1; fi
grep -q '"production"' android/app/build.gradle.kts || { echo 'ERROR: production signing profile missing' >&2; exit 1; }
grep -q 'signingConfig = signingConfigs.getByName("release")' android/app/build.gradle.kts || { echo 'ERROR: production release signing config missing' >&2; exit 1; }

echo '[3] API base URL'
grep -RIn 'API_BASE_URL' lib android README.md || true

echo '[4] Backend syntax'
for f in backend/src/*.js; do node --check "$f"; done

echo '[5] Payment provider production guard'
grep -q 'PAYMENT_PROVIDER=webhook is required in production' backend/src/config.js || { echo 'ERROR: production payment provider guard missing' >&2; exit 1; }

echo '[6] Dependency audit (offline cache if available)'
(cd backend && npm audit --offline --json)
