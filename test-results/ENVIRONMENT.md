# HOPE-V7 Test Session Environment

Session: hope-v7-test-20260913T0010Z (started 2026-09-12T23:34:00Z, finished 2026-09-13T00:10:13Z)

## Hardware
| Item | Value |
|---|---|
| OS | Linux (Ubuntu 24.04 userland) x86_64, kernel 6.18.15 |
| CPU | 2 vCPU |
| RAM | ~1.9 GiB total, ~1.8 GiB available |
| Disk free | ~14.5 GB at session end |

## Toolchain (as used)
| Tool | Required by repo | Available in session | Status |
|---|---|---|---|
| Node | 24 (>=24 <25, .nvmrc=24) | v24.21.0 (installed this session via NodeSource) | OK |
| npm | - | 11.19.0 | OK |
| Java/JDK | 17 (.java-version=17, android pin) | OpenJDK 21 preinstalled; OpenJDK 17 (javac 17.0.20) installed this session | OK after install |
| Flutter | 3.47.2 | 3.47.2 stable (downloaded and installed this session), Dart 3.13.2 | OK after install |
| PostgreSQL | 16 | 16.15 (apt; service started this session) | OK after install |
| Android SDK / adb / emulator | SDK 36, build-tools 36.0.0, NDK 28.2.13676358 | ABSENT | MISSING |
| Docker | docker-compose topologies (staging, DR CI) | ABSENT | MISSING |
| Gradle | wrapper 8.14.3 | wrapper present; invocation timed out on this runner | PARTIAL |
| Python | - | 3.12.3 | OK |
| Git | - | 2.43.0 | OK |

## Dependency impact
| Dependency | Required version | Available version | Status | Impacted tests |
|---|---|---|---|---|
| Node 24 | >=24 <25 | v24.21.0 | RESOLVED (installed) | all backend suites (runtime-version-contract enforces major=24) |
| JDK 17 | 17 | 17.0.20 | RESOLVED (installed) | runtime-certification-preflight, Android builds |
| Flutter 3.47.2 | 3.47.2 | 3.47.2 | RESOLVED (installed) | flutter analyze/test/coverage |
| PostgreSQL 16 | 16 | 16.15 | RESOLVED (installed) | test:postgres, migrations, DR drill |
| Android SDK/adb/emulator | SDK 36 | absent | MISSING | ./gradlew test, connectedAndroidTest, integration_test/ device runs |
| Docker | any | absent | MISSING | containerized staging/S3/DR topologies |
| S3 endpoint + creds | sandbox creds | absent | MISSING | test:s3, s3 part of test:integration-required |
| Deployed staging API | STAGING_BASE_URL | absent | MISSING | tools/staging-smoke.sh |
| Runner RAM | >= 6144 MiB | 1989 MiB | INSUFFICIENT | ci-resource-guard, gradle runtime |

No secrets were present or required; none are printed in any evidence file.
