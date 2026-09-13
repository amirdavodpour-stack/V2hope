// Root Gradle configuration for the HOPE Flutter application.
//
// Flutter expects Android build outputs under the Flutter project root:
//   build/app/outputs/...
//
// Keep Gradle's project/module build directories aligned with that
// Flutter-managed build directory so `flutter build apk` can discover the
// artifact after Gradle completes successfully.

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val flutterProjectRoot = rootProject.projectDir.parentFile
val flutterBuildDir = flutterProjectRoot.resolve("build")

rootProject.layout.buildDirectory.set(flutterBuildDir)

subprojects {
    layout.buildDirectory.set(
        flutterBuildDir.resolve(project.name)
    )
}

tasks.register<Delete>("clean") {
    delete(flutterBuildDir)
}
