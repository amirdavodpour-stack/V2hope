# Android APK Build

## Toolchain

- Flutter: `3.47.2` stable
- Android compile SDK: `36`
- Android target SDK: `36`
- Android min SDK: `30`
- Java/JVM target: `17`
- Android Gradle Plugin: `8.11.1`
- Kotlin Gradle Plugin: `2.2.20`
- Gradle: `8.14.3`

## Debug build

```bash
flutter run --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

## Release build

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```

Production release signing is fail-closed. Provide the release keystore outside the repository through the environment variables documented in `android/ANDROID-CONFIG.md`. A debug keystore must never be used for a production release.
