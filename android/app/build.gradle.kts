import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.redsracing.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.redsracing.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 54
        versionName = "6.3"

        resourceConfigurations += listOf("en")
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
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        viewBinding = true
        dataBinding = true
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

dependencies {
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:2.2.0"))
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("com.google.android.play:integrity:1.5.0")
}
