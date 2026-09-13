plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("dev.flutter.flutter-gradle-plugin")
}

val appRoot = rootProject.projectDir.parentFile
val pubspecText = appRoot.resolve("pubspec.yaml").readText()
val appVersion = Regex("(?m)^version:\\s*([^\r\n]+)").find(pubspecText)?.groupValues?.get(1)?.trim()
    ?: error("pubspec.yaml version is required")
val versionParts = appVersion.split("+", limit = 2)
require(versionParts.size == 2 && versionParts[0].isNotBlank() && versionParts[1].matches(Regex("\\d+"))) {
    "pubspec.yaml version must use <versionName>+<versionCode>, got: $appVersion"
}
val appVersionName = versionParts[0]
val appVersionCode = versionParts[1].toIntOrNull()
    ?: error("pubspec.yaml versionCode is not a valid integer: ${versionParts[1]}")

android {
    namespace = "com.hope.marketplace"
    compileSdk = 36
    ndkVersion = "28.2.13676358"

    defaultConfig {
        applicationId = "com.hope.marketplace"
        minSdk = 30
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    signingConfigs {
        create("release") {
            val storeFilePath = System.getenv("ANDROID_RELEASE_STORE_FILE")
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = file(storeFilePath)
                storePassword = System.getenv("ANDROID_RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            val releaseRequested = gradle.startParameter.taskNames.any { task ->
                task.contains("Release", ignoreCase = true)
            }
            val profile = System.getenv("BUILD_PROFILE")?.lowercase()
                ?: if (releaseRequested) "production" else "pilot"
            when (profile) {
                "production" -> {
                    // Gradle configures all build types even when assembleDebug is requested.
                    // Do not fail debug configuration just because production signing secrets
                    // are absent; enforce them only when the production release task executes.
                    if (releaseRequested) {
                        val releaseStore = System.getenv("ANDROID_RELEASE_STORE_FILE")
                        val releasePassword = System.getenv("ANDROID_RELEASE_STORE_PASSWORD")
                        val releaseAlias = System.getenv("ANDROID_RELEASE_KEY_ALIAS")
                        val releaseKeyPassword = System.getenv("ANDROID_RELEASE_KEY_PASSWORD")
                        if (releaseStore.isNullOrBlank() || releasePassword.isNullOrBlank() ||
                            releaseAlias.isNullOrBlank() || releaseKeyPassword.isNullOrBlank()) {
                            error("Production release requires ANDROID_RELEASE_STORE_FILE and all signing credentials")
                        }
                    }
                    signingConfig = signingConfigs.getByName("release")
                }
                "pilot" -> {
                    // Pilot artifacts are non-production test builds. They may use the
                    // Android debug keystore so CI can build without handling production
                    // signing material. The release workflow never uses this profile.
                    signingConfig = signingConfigs.getByName("debug")
                }
                else -> error("Unsupported BUILD_PROFILE: $profile")
            }
            applicationIdSuffix = if (profile == "pilot") ".pilot" else ""
            isMinifyEnabled = profile == "production"
            isShrinkResources = profile == "production"
        }
    }
}

flutter {
    source = "../.."
}
