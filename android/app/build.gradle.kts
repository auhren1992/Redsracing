import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.github.triplet.play")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.redsracing.app"
    compileSdk = 36

    // Python Cloud Functions copy under assets/ is not used in the WebView APK.
    androidResources {
        ignoreAssetsPattern =
            "!.svn:!.git:.*:!CVS:!thumbs.db:!picasa.ini:!README:!functions_python:!functions_python/**"
    }

    defaultConfig {
        applicationId = "com.redsracing.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 218
        versionName = "11.2.32"
        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
        }
    }

    signingConfigs {
        create("release") {
            storeFile = file("../upload-keystore.jks")
            storePassword = project.findProperty("REDSRACING_KEYSTORE_PASSWORD") as String? ?: ""
            keyAlias = "upload"
            keyPassword = project.findProperty("REDSRACING_KEY_PASSWORD") as String? ?: ""
        }
    }

    buildTypes {
        release {
            // Play DEX coverage: shrinking + optimization + obfuscation via R8
            // (proguard-android-optimize.txt). Target ≥25% across all three.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    buildFeatures {
        viewBinding = true
        dataBinding = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

play {
    // Play Developer API track id (Play Console "Closed testing" default track is `alpha`).
    track.set("alpha")
    defaultToAppBundles.set(true)
    // CI/local: JSON file path (Gradle -Pplay.serviceAccountCredentials=/abs/path.json)
    val credPath = (project.findProperty("play.serviceAccountCredentials") as? String)?.trim()
    if (!credPath.isNullOrBlank()) {
        serviceAccountCredentials.set(file(credPath))
    }
    // Otherwise GPP reads ANDROID_PUBLISHER_CREDENTIALS (full JSON string). See README § Authenticating.
}

dependencies {
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:2.2.0"))
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.13.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("com.google.android.play:integrity:1.5.0")
    // Google Mobile Ads SDK
    implementation("com.google.android.gms:play-services-ads:23.6.0")
    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")
    // Encrypted storage for auth tokens
    implementation("androidx.security:security-crypto:1.1.0")
    implementation("androidx.biometric:biometric:1.1.0")
}
