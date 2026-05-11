// Root Gradle build file
//
// AGP 8.11.0 is the last stable 8.x release (June 2025) and is the highest
// AGP version that supports our current DSL without the breaking changes
// introduced in AGP 9.0. It requires Gradle 8.13 (we have it) and JDK 17
// (CI provides it), and supports compileSdk 36.
//
// We previously pinned to 8.9.0-rc01, an RC build that has since been
// removed from the plugin portal — every Android CI run after the RC
// was unpublished failed within seconds during plugin resolution.
plugins {
    id("com.android.application") version "8.11.0" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("com.github.triplet.play") version "3.12.1" apply false // pinned: 4.x requires AGP 9 + new DSL
    id("com.google.gms.google-services") version "4.4.2" apply false
}
