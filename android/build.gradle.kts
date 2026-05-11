// Root Gradle build file.
//
// AGP 8.11.0 is the last stable 8.x release (June 2025). It supports our
// current DSL without the breaking changes introduced in AGP 9.0, requires
// Gradle 8.13+ (we ship 8.13 in gradle-wrapper.properties), JDK 17 (CI
// provides it via actions/setup-java), and supports compileSdk 36.
//
// triplet.play is pinned to 3.12.1 — the last 3.x release. 4.x requires
// AGP 9 and a new DSL.
plugins {
    id("com.android.application") version "8.11.0" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("com.github.triplet.play") version "3.12.1" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
}
